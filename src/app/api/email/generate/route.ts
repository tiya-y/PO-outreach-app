import { NextRequest, NextResponse } from 'next/server';
import { generateOutreachEmail } from '@/lib/claude';
import { enrichPerson } from '@/lib/apollo';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { prospectId, sequenceStep = 1, saveAsDraft = true } = await req.json();
    const supabase = createServiceClient();

    // Fetch prospect + campaign
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const campaign = prospect.campaigns as Record<string, unknown>;

    // ── Reveal email now (1 export credit) if we don't have it yet ───────────
    if (!prospect.email && (prospect.first_name || prospect.linkedin_url)) {
      try {
        const person = await enrichPerson({
          linkedin_url: prospect.linkedin_url ?? undefined,
          first_name: prospect.first_name ?? undefined,
          last_name: prospect.last_name ?? undefined,
          organization_name: prospect.company ?? undefined,
          revealEmail: true, // spend the credit here
        });
        if (person?.email) {
          await supabase.from('prospects').update({ email: person.email }).eq('id', prospectId);
          prospect.email = person.email;
        }
      } catch (e) {
        console.error('Email reveal failed:', e);
      }
    }

    const email = await generateOutreachEmail({
      firstName: prospect.first_name ?? 'there',
      lastName: prospect.last_name ?? '',
      title: prospect.title ?? 'Property Manager',
      company: prospect.company ?? 'your company',
      city: prospect.city ?? campaign?.city as string ?? '',
      portfolioSize: prospect.portfolio_size ?? undefined,
      compensation: campaign?.compensation as string ?? undefined,
      sequenceStep,
    });

    if (saveAsDraft) {
      const { data: savedEmail } = await supabase.from('outreach_emails').insert({
        prospect_id: prospectId,
        campaign_id: prospect.campaign_id,
        subject: email.subject,
        body_text: email.body,
        body_html: textToHtml(email.body),
        sequence_step: sequenceStep,
        status: 'draft',
        ai_generated: true,
      }).select().single();

      return NextResponse.json({ email, savedId: savedEmail?.id });
    }

    return NextResponse.json({ email });
  } catch (error) {
    return NextResponse.json({ error: 'Email generation failed', detail: String(error) }, { status: 500 });
  }
}

// Bulk generate emails for multiple prospects
export async function PUT(req: NextRequest) {
  try {
    const { prospectIds, sequenceStep = 1 } = await req.json();
    const supabase = createServiceClient();

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array required' }, { status: 400 });
    }

    const { data: prospects } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .in('id', prospectIds);

    if (!prospects?.length) return NextResponse.json({ error: 'No prospects found' }, { status: 404 });

    const generated = [];
    for (const prospect of prospects) {
      const campaign = prospect.campaigns as Record<string, unknown>;
      try {
        const email = await generateOutreachEmail({
          firstName: prospect.first_name ?? 'there',
          lastName: prospect.last_name ?? '',
          title: prospect.title ?? 'Property Manager',
          company: prospect.company ?? 'your company',
          city: prospect.city ?? campaign?.city as string ?? '',
          portfolioSize: prospect.portfolio_size ?? undefined,
          compensation: campaign?.compensation as string ?? undefined,
          sequenceStep,
        });

        const { data: saved } = await supabase.from('outreach_emails').insert({
          prospect_id: prospect.id,
          campaign_id: prospect.campaign_id,
          subject: email.subject,
          body_text: email.body,
          body_html: textToHtml(email.body),
          sequence_step: sequenceStep,
          status: 'draft',
          ai_generated: true,
        }).select().single();

        generated.push({ prospectId: prospect.id, emailId: saved?.id, subject: email.subject });
      } catch (e) {
        generated.push({ prospectId: prospect.id, error: String(e) });
      }
    }

    return NextResponse.json({ generated, count: generated.filter((g) => !g.error).length });
  } catch (error) {
    return NextResponse.json({ error: 'Bulk generation failed', detail: String(error) }, { status: 500 });
  }
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${paragraphs.join('')}</div>`;
}
