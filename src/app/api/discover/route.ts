import { NextRequest, NextResponse } from 'next/server';
import { searchPeopleByCity } from '@/lib/apollo';
import { createServiceClient } from '@/lib/supabase';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { campaignId, city, state, page = 1 } = await req.json();

    if (!campaignId || !city || !state) {
      return NextResponse.json({ error: 'campaignId, city, and state are required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── Apollo people search ─────────────────────────────────────────────────
    let apolloPeople: Array<Record<string, unknown>> = [];
    let totalFound = 0;
    try {
      const apolloData = await searchPeopleByCity({ city, state, page, perPage: 50 });
      const all = apolloData.people ?? apolloData.contacts ?? [];
      totalFound = all.length;
      // Only keep people where Apollo already has an email — no export credits spent
      apolloPeople = all.filter((p: Record<string, unknown>) => p.email && p.email !== '');
      console.log(`Apollo: ${totalFound} total, ${apolloPeople.length} with email`);
    } catch (e) {
      console.error('Apollo search error:', e);
      return NextResponse.json({ error: 'Apollo search failed', detail: String(e) }, { status: 500 });
    }

    const results = apolloPeople.map((person) => {
      const org = (person.organization as Record<string, unknown>) ?? {};
      return {
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: (person.sanitized_phone as string) ?? null,
        title: person.title,
        company: (org.name as string) ?? null,
        company_website: (org.website_url as string) ?? null,
        linkedin_url: person.linkedin_url,
        city,
        state,
        company_employee_count: (org.num_employees as number) ?? null,
        source: 'apollo',
        apollo_id: person.id,
        apollo_org_id: (org.id as string) ?? null,
        qualification_score: 50,
        qualification_notes: 'Pending enrichment',
        campaign_id: campaignId,
        status: 'new',
      };
    });

    // ── De-duplicate by email before inserting ───────────────────────────────
    const { data: existing } = await supabase
      .from('prospects')
      .select('email, company_website')
      .eq('campaign_id', campaignId);

    const existingEmails = new Set((existing ?? []).map((p) => p.email).filter(Boolean));
    const existingDomains = new Set((existing ?? []).map((p) => p.company_website).filter(Boolean));

    const fresh = results.filter((p) => {
      if (p.email && existingEmails.has(p.email as string)) return false;
      if (p.company_website && existingDomains.has(p.company_website as string)) return false;
      return true;
    });

    // ── Insert to Supabase ───────────────────────────────────────────────────
    if (fresh.length > 0) {
      await supabase.from('prospects').insert(fresh);
      try {
        await supabase.rpc('update_campaign_counts' as never, { p_campaign_id: campaignId } as never);
      } catch {
        await supabase.from('campaigns')
          .update({ prospect_count: (existing?.length ?? 0) + fresh.length })
          .eq('id', campaignId);
      }
    }

    return NextResponse.json({
      inserted: fresh.length,
      total_found: totalFound,
      with_email: apolloPeople.length,
      duplicates_skipped: apolloPeople.length - fresh.length,
    });
  } catch (error) {
    console.error('Discover error:', error);
    return NextResponse.json({ error: 'Discovery failed', detail: String(error) }, { status: 500 });
  }
}
