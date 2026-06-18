import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph, refreshAccessToken } from '@/lib/ms365';
import { sendEmail } from '@/lib/brevo';
import { createServiceClient } from '@/lib/supabase';

// Fetch the first active sales rep's M365 token, refreshing if needed
async function getActiveToken(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: reps } = await supabase
    .from('sales_reps')
    .select('id, ms365_access_token, ms365_refresh_token, token_expires_at')
    .eq('is_active', true)
    .not('ms365_access_token', 'is', null)
    .limit(1);

  const rep = reps?.[0];
  if (!rep?.ms365_access_token) return null;

  const expiresAt = rep.token_expires_at ? new Date(rep.token_expires_at) : null;
  if (expiresAt && expiresAt < new Date(Date.now() + 120_000)) {
    try {
      const refreshed = await refreshAccessToken(rep.ms365_refresh_token);
      await supabase.from('sales_reps').update({
        ms365_access_token: refreshed.access_token,
        ms365_refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('id', rep.id);
      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return rep.ms365_access_token;
}

// POST { emailId, bodyOverride? } — send a draft outreach email
export async function POST(req: NextRequest) {
  try {
    const { emailId, bodyOverride } = await req.json();
    const supabase = createServiceClient();

    const { data: email } = await supabase
      .from('outreach_emails')
      .select('*, prospects(*)')
      .eq('id', emailId)
      .single();

    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    if (email.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 });

    const prospect = email.prospects as Record<string, unknown>;
    if (!prospect?.email) return NextResponse.json({ error: 'Prospect has no email address' }, { status: 400 });

    const toEmail = prospect.email as string;
    const toName = `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Manager';
    const bodyHtml = bodyOverride
      ? `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6">${bodyOverride.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
      : (email.body_html ?? `<p>${email.body_text}</p>`);

    const token = await getActiveToken();
    let sentVia = 'brevo';

    if (token) {
      await sendMailViaGraph(token, { toEmail, toName, subject: email.subject, bodyHtml });
      sentVia = 'ms365';
    } else {
      await sendEmail({ toEmail, toName, subject: email.subject, htmlContent: bodyHtml, tags: ['innago-outreach'] });
    }

    if (bodyOverride) {
      await supabase.from('outreach_emails').update({ body_text: bodyOverride, body_html: bodyHtml }).eq('id', emailId);
    }

    await supabase.from('outreach_emails').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', emailId);

    await supabase.from('prospects').update({
      status: 'contacted',
      last_contacted_at: new Date().toISOString(),
    }).eq('id', email.prospect_id);

    return NextResponse.json({ success: true, sentVia });
  } catch (error) {
    return NextResponse.json({ error: 'Send failed', detail: String(error) }, { status: 500 });
  }
}

// PUT { emailIds } — bulk approve & send
export async function PUT(req: NextRequest) {
  try {
    const { emailIds } = await req.json();
    if (!Array.isArray(emailIds) || !emailIds.length) {
      return NextResponse.json({ error: 'emailIds array required' }, { status: 400 });
    }
    const supabase = createServiceClient();
    const token = await getActiveToken();

    const { data: emails } = await supabase
      .from('outreach_emails')
      .select('*, prospects(*)')
      .in('id', emailIds)
      .eq('status', 'draft');

    if (!emails?.length) return NextResponse.json({ error: 'No draft emails found' }, { status: 404 });

    const results: { emailId: string; success?: boolean; error?: string; sentVia?: string }[] = [];
    for (const email of emails) {
      const prospect = email.prospects as Record<string, unknown>;
      if (!prospect?.email) { results.push({ emailId: email.id, error: 'No email address' }); continue; }

      const toEmail = prospect.email as string;
      const toName = `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Manager';
      const bodyHtml = email.body_html ?? `<p>${email.body_text}</p>`;

      try {
        let sentVia = 'brevo';
        if (token) {
          await sendMailViaGraph(token, { toEmail, toName, subject: email.subject, bodyHtml });
          sentVia = 'ms365';
        } else {
          await sendEmail({ toEmail, toName, subject: email.subject, htmlContent: bodyHtml, tags: ['innago-outreach'] });
        }
        await supabase.from('outreach_emails').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', email.id);
        await supabase.from('prospects').update({ status: 'contacted', last_contacted_at: new Date().toISOString() }).eq('id', email.prospect_id);
        results.push({ emailId: email.id, success: true, sentVia });
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        results.push({ emailId: email.id, error: String(e) });
      }
    }

    return NextResponse.json({ results, sent: results.filter((r) => r.success).length, failed: results.filter((r) => r.error).length });
  } catch (error) {
    return NextResponse.json({ error: 'Bulk send failed', detail: String(error) }, { status: 500 });
  }
}
