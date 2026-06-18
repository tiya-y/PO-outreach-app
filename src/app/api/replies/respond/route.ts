import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph, refreshAccessToken } from '@/lib/ms365';
import { sendEmail } from '@/lib/brevo';
import { createServiceClient } from '@/lib/supabase';

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

// POST { replyId, subject, body } — send an approved reply and mark handled
export async function POST(req: NextRequest) {
  try {
    const { replyId, subject, body } = await req.json();
    const supabase = createServiceClient();

    const { data: reply } = await supabase
      .from('replies')
      .select('*, prospects(*)')
      .eq('id', replyId)
      .single();

    if (!reply) return NextResponse.json({ error: 'Reply not found' }, { status: 404 });

    const prospect = reply.prospects as Record<string, unknown>;
    if (!prospect?.email) return NextResponse.json({ error: 'Prospect has no email address' }, { status: 400 });

    const toEmail = prospect.email as string;
    const toName = `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() || 'Property Manager';
    const bodyHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6">${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`;

    const token = await getActiveToken();
    let sentVia = 'brevo';

    if (token) {
      await sendMailViaGraph(token, { toEmail, toName, subject, bodyHtml });
      sentVia = 'ms365';
    } else {
      await sendEmail({ toEmail, toName, subject, htmlContent: bodyHtml, tags: ['innago-reply'] });
    }

    // Save the outgoing reply as an outreach_email for tracking
    await supabase.from('outreach_emails').insert({
      prospect_id: reply.prospect_id,
      campaign_id: (prospect.campaign_id as string) ?? null,
      subject,
      body_text: body,
      body_html: bodyHtml,
      sequence_step: 0,
      status: 'sent',
      sent_at: new Date().toISOString(),
      ai_generated: true,
    });

    // Mark reply as handled
    await supabase.from('replies').update({
      handled: true,
      handled_at: new Date().toISOString(),
      response_sent: body,
    }).eq('id', replyId);

    return NextResponse.json({ success: true, sentVia });
  } catch (error) {
    return NextResponse.json({ error: 'Reply send failed', detail: String(error) }, { status: 500 });
  }
}
