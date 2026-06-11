import { NextRequest, NextResponse } from 'next/server';
import { generatePreCallBrief } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

// Preview meeting brief + invite WITHOUT booking on MS365
export async function POST(req: NextRequest) {
  try {
    const { prospectId, salesRepEmail, startTime } = await req.json();
    if (!prospectId) return NextResponse.json({ error: 'prospectId required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    // Get email history
    const { data: emailHistory } = await supabase
      .from('outreach_emails')
      .select('sequence_step, subject, sent_at, opened_at, replied_at')
      .eq('prospect_id', prospectId)
      .order('sequence_step');

    const { data: latestReply } = await supabase
      .from('replies')
      .select('raw_content, classification')
      .eq('prospect_id', prospectId)
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    const brief = await generatePreCallBrief({
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
      meetingTime: startTime ?? new Date().toISOString(),
    });

    // Build the invite body preview
    const prospectName = `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim();
    const meetingSubject = `Innago Demo — ${prospectName} (${prospect.company ?? prospect.city})`;

    const invitePreview = `Subject: ${meetingSubject}
Duration: 30 minutes
Attendees: ${salesRepEmail ?? '[rep email]'}, ${prospect.email ?? '[prospect email]'}

Hi ${prospect.first_name ?? 'there'},

Looking forward to our quick 30-minute demo of Innago — I'll walk you through how it can save you time managing your properties.

Agenda:
• Quick overview of Innago's core features (rent collection, maintenance, tenant screening)
• See how other ${prospect.city ?? 'local'} landlords are using it
• Answer any questions you have
• Walk through a free setup if you're ready

No prep needed on your end. See you then!`;

    return NextResponse.json({
      prospect: {
        id: prospect.id,
        name: prospectName,
        email: prospect.email,
        company: prospect.company,
        city: prospect.city,
        portfolioSize: prospect.portfolio_size,
      },
      meetingSubject,
      scheduledAt: startTime,
      salesRepEmail,
      brief,
      invitePreview,
      emailHistory: emailHistory ?? [],
      replyClassification: latestReply?.classification ?? null,
      _preview: true,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Meeting preview failed', detail: String(error) }, { status: 500 });
  }
}
