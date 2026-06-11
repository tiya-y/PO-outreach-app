import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/brevo';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { emailId } = await req.json();
    const supabase = createServiceClient();

    // Fetch email + prospect
    const { data: email } = await supabase
      .from('outreach_emails')
      .select('*, prospects(*)')
      .eq('id', emailId)
      .single();

    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    if (email.status === 'sent') return NextResponse.json({ error: 'Email already sent' }, { status: 400 });

    const prospect = email.prospects as Record<string, unknown>;

    if (!prospect?.email) {
      return NextResponse.json({ error: 'Prospect has no email address' }, { status: 400 });
    }

    // Send via Brevo
    const result = await sendEmail({
      toEmail: prospect.email as string,
      toName: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Manager',
      subject: email.subject,
      htmlContent: email.body_html ?? `<p>${email.body_text}</p>`,
      tags: ['innago-outreach', `step-${email.sequence_step}`],
    });

    // Mark email as sent
    await supabase.from('outreach_emails').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      brevo_message_id: result.messageId ?? null,
    }).eq('id', emailId);

    // Update prospect status
    await supabase.from('prospects').update({
      status: 'contacted',
      last_contacted_at: new Date().toISOString(),
    }).eq('id', email.prospect_id);

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    return NextResponse.json({ error: 'Send failed', detail: String(error) }, { status: 500 });
  }
}

// Bulk send
export async function PUT(req: NextRequest) {
  try {
    const { emailIds } = await req.json();
    const supabase = createServiceClient();

    if (!Array.isArray(emailIds)) {
      return NextResponse.json({ error: 'emailIds array required' }, { status: 400 });
    }

    const { data: emails } = await supabase
      .from('outreach_emails')
      .select('*, prospects(*)')
      .in('id', emailIds)
      .eq('status', 'draft');

    if (!emails?.length) return NextResponse.json({ error: 'No draft emails found' }, { status: 404 });

    const results = [];
    for (const email of emails) {
      const prospect = email.prospects as Record<string, unknown>;
      if (!prospect?.email) {
        results.push({ emailId: email.id, error: 'No email address' });
        continue;
      }

      try {
        const result = await sendEmail({
          toEmail: prospect.email as string,
          toName: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Manager',
          subject: email.subject,
          htmlContent: email.body_html ?? `<p>${email.body_text}</p>`,
          tags: ['innago-outreach', `step-${email.sequence_step}`],
        });

        await supabase.from('outreach_emails').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          brevo_message_id: result.messageId ?? null,
        }).eq('id', email.id);

        await supabase.from('prospects').update({
          status: 'contacted',
          last_contacted_at: new Date().toISOString(),
        }).eq('id', email.prospect_id);

        results.push({ emailId: email.id, success: true });

        // Rate limit: 5 emails/second
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        results.push({ emailId: email.id, error: String(e) });
      }
    }

    const sent = results.filter((r) => r.success).length;
    return NextResponse.json({ results, sent, failed: results.length - sent });
  } catch (error) {
    return NextResponse.json({ error: 'Bulk send failed', detail: String(error) }, { status: 500 });
  }
}
