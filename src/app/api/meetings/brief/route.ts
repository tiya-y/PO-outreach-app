import { NextRequest, NextResponse } from 'next/server';
import { generatePreCallBrief } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

// Regenerate or fetch the pre-call brief for a meeting
export async function POST(req: NextRequest) {
  try {
    const { meetingId } = await req.json();
    const supabase = createServiceClient();

    const { data: meeting } = await supabase
      .from('meetings')
      .select('*, prospects(*)')
      .eq('id', meetingId)
      .single();

    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    const prospect = meeting.prospects as Record<string, unknown>;

    // Get email history
    const { data: emailHistory } = await supabase
      .from('outreach_emails')
      .select('sequence_step, subject, sent_at, opened_at, replied_at')
      .eq('prospect_id', meeting.prospect_id)
      .order('sequence_step');

    // Get latest reply
    const { data: latestReply } = await supabase
      .from('replies')
      .select('raw_content')
      .eq('prospect_id', meeting.prospect_id)
      .order('received_at', { ascending: false })
      .limit(1)
      .single();

    const brief = await generatePreCallBrief({
      prospect: {
        firstName: (prospect.first_name as string) ?? '',
        lastName: (prospect.last_name as string) ?? '',
        title: (prospect.title as string) ?? '',
        company: (prospect.company as string) ?? '',
        city: (prospect.city as string) ?? '',
        portfolioSize: (prospect.portfolio_size as number) ?? undefined,
        linkedinUrl: (prospect.linkedin_url as string) ?? undefined,
        website: (prospect.company_website as string) ?? undefined,
        enrichmentData: (prospect.enrichment_data as Record<string, unknown>) ?? {},
      },
      emailHistory: (emailHistory ?? []).map((e) => ({
        step: e.sequence_step,
        subject: e.subject,
        sentAt: e.sent_at ?? '',
        opened: !!e.opened_at,
        replied: !!e.replied_at,
      })),
      reply: latestReply?.raw_content ?? undefined,
      meetingTime: meeting.scheduled_at,
    });

    // Save brief
    await supabase.from('meetings').update({
      brief_markdown: brief,
      brief_generated_at: new Date().toISOString(),
    }).eq('id', meetingId);

    return NextResponse.json({ brief });
  } catch (error) {
    return NextResponse.json({ error: 'Brief generation failed', detail: String(error) }, { status: 500 });
  }
}

// Get existing brief
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get('meetingId');

  if (!meetingId) return NextResponse.json({ error: 'meetingId required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: meeting } = await supabase
    .from('meetings')
    .select('brief_markdown, brief_generated_at, scheduled_at, prospects(first_name, last_name, company)')
    .eq('id', meetingId)
    .single();

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(meeting);
}
