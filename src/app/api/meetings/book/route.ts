import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting, refreshAccessToken } from '@/lib/ms365';
import { generatePreCallBrief } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { prospectId, salesRepEmail, startTime, endTime, generateBrief = true } = await req.json();
    const supabase = createServiceClient();

    // Fetch prospect
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    // Fetch sales rep + token
    const { data: rep } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('email', salesRepEmail)
      .single();

    if (!rep?.ms365_access_token) {
      return NextResponse.json({ error: 'Sales rep not connected to MS365. Connect via /settings.' }, { status: 400 });
    }

    // Refresh token if needed
    let accessToken = rep.ms365_access_token;
    if (rep.token_expires_at && new Date(rep.token_expires_at) < new Date()) {
      try {
        const refreshed = await refreshAccessToken(rep.ms365_refresh_token!);
        accessToken = refreshed.access_token;
        await supabase.from('sales_reps').update({
          ms365_access_token: refreshed.access_token,
          ms365_refresh_token: refreshed.refresh_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('id', rep.id);
      } catch (e) {
        return NextResponse.json({ error: 'MS365 token expired. Please reconnect.' }, { status: 401 });
      }
    }

    // Book the meeting
    const prospectName = `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Owner';
    const attendees = [salesRepEmail];
    if (prospect.email) attendees.push(prospect.email);

    const event = await bookMeeting({
      accessToken,
      subject: `Innago Demo — ${prospectName} (${prospect.company ?? prospect.city})`,
      startTime,
      endTime,
      attendeeEmails: attendees,
      bodyHtml: buildMeetingInviteHtml(prospect, salesRepEmail),
      onlineMeetingRequired: true,
    });

    // Generate brief
    let briefMarkdown: string | null = null;
    if (generateBrief) {
      try {
        const { data: emailHistory } = await supabase
          .from('outreach_emails')
          .select('sequence_step, subject, sent_at, opened_at, replied_at')
          .eq('prospect_id', prospectId)
          .order('sequence_step');

        const { data: latestReply } = await supabase
          .from('replies')
          .select('raw_content')
          .eq('prospect_id', prospectId)
          .order('received_at', { ascending: false })
          .limit(1)
          .single();

        briefMarkdown = await generatePreCallBrief({
          prospect: {
            firstName: prospect.first_name ?? '',
            lastName: prospect.last_name ?? '',
            title: prospect.title ?? '',
            company: prospect.company ?? '',
            city: prospect.city ?? '',
            portfolioSize: prospect.portfolio_size ?? undefined,
            linkedinUrl: prospect.linkedin_url ?? undefined,
            website: prospect.company_website ?? undefined,
            enrichmentData: prospect.enrichment_data ?? {},
          },
          emailHistory: (emailHistory ?? []).map((e) => ({
            step: e.sequence_step,
            subject: e.subject,
            sentAt: e.sent_at ?? '',
            opened: !!e.opened_at,
            replied: !!e.replied_at,
          })),
          reply: latestReply?.raw_content ?? undefined,
          meetingTime: startTime,
        });
      } catch (e) {
        console.error('Brief generation error:', e);
      }
    }

    // Save meeting to DB
    const { data: meeting } = await supabase.from('meetings').insert({
      prospect_id: prospectId,
      campaign_id: prospect.campaign_id,
      sales_rep_email: salesRepEmail,
      scheduled_at: startTime,
      duration_minutes: 30,
      meeting_link: event.onlineMeeting?.joinUrl ?? null,
      ms_event_id: event.id ?? null,
      brief_markdown: briefMarkdown,
      brief_generated_at: briefMarkdown ? new Date().toISOString() : null,
      status: 'scheduled',
    }).select().single();

    // Update prospect status
    await supabase.from('prospects').update({ status: 'meeting_booked' }).eq('id', prospectId);

    return NextResponse.json({ meeting, msEventId: event.id, meetingLink: event.onlineMeeting?.joinUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Meeting booking failed', detail: String(error) }, { status: 500 });
  }
}

function buildMeetingInviteHtml(prospect: Record<string, unknown>, repEmail: string): string {
  return `
<p>Hi ${prospect.first_name ?? 'there'},</p>
<p>Looking forward to our quick 30-minute demo of Innago — I'll walk you through how it can save you time managing your properties.</p>
<p><strong>Agenda:</strong></p>
<ul>
  <li>Quick overview of Innago's core features (rent collection, maintenance, tenant screening)</li>
  <li>See how other ${prospect.city ?? 'local'} landlords are using it</li>
  <li>Answer any questions you have</li>
  <li>Walk through a free setup if you're ready</li>
</ul>
<p>No prep needed on your end. See you then!</p>
<p>— ${repEmail}</p>
<p style="color:#888;font-size:12px;">Innago is 100% free property management software. No monthly fees, no contracts.</p>
`;
}
