import { NextRequest, NextResponse } from 'next/server';
import { generateOutreachEmail } from '@/lib/claude';
import { sendEmail } from '@/lib/brevo';
import { createServiceClient } from '@/lib/supabase';

// Launch a full 5-step follow-up sequence for a prospect
export async function POST(req: NextRequest) {
  try {
    const { prospectId, steps = 5, delayDays = [0, 3, 7, 14, 21] } = await req.json();
    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    if (!prospect.email) return NextResponse.json({ error: 'Prospect has no email' }, { status: 400 });

    const campaign = prospect.campaigns as Record<string, unknown>;
    const generatedEmails = [];

    for (let step = 1; step <= steps; step++) {
      const email = await generateOutreachEmail({
        firstName: prospect.first_name ?? 'there',
        lastName: prospect.last_name ?? '',
        title: prospect.title ?? 'Property Manager',
        company: prospect.company ?? 'your company',
        city: prospect.city ?? (campaign?.city as string) ?? '',
        portfolioSize: prospect.portfolio_size ?? undefined,
        compensation: (campaign?.compensation as string) ?? undefined,
        sequenceStep: step,
      });

      const sendDate = new Date(Date.now() + delayDays[step - 1] * 86400000);

      const { data: savedEmail } = await supabase.from('outreach_emails').insert({
        prospect_id: prospectId,
        campaign_id: prospect.campaign_id,
        subject: email.subject,
        body_text: email.body,
        body_html: textToHtml(email.body),
        sequence_step: step,
        status: step === 1 ? 'draft' : 'scheduled',
        scheduled_at: step === 1 ? null : sendDate.toISOString(),
        ai_generated: true,
      }).select().single();

      generatedEmails.push({ step, emailId: savedEmail?.id, scheduledFor: sendDate });
    }

    // Save sequence record
    await supabase.from('sequences').insert({
      campaign_id: prospect.campaign_id,
      prospect_id: prospectId,
      total_steps: steps,
      current_step: 1,
      status: 'active',
      next_touch_at: new Date().toISOString(),
    });

    return NextResponse.json({ emails: generatedEmails, count: generatedEmails.length });
  } catch (error) {
    return NextResponse.json({ error: 'Sequence creation failed', detail: String(error) }, { status: 500 });
  }
}

function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = escaped.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">${paragraphs.join('')}</div>`;
}
