import { NextRequest, NextResponse } from 'next/server';
import { searchPeopleByCity, searchCompaniesByCity } from '@/lib/apollo';
import { findRankingPMSitesForCity } from '@/lib/ahrefs';
import { createServiceClient } from '@/lib/supabase';
import { scoreProspect } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, city, state, page = 1 } = await req.json();

    if (!campaignId || !city || !state) {
      return NextResponse.json({ error: 'campaignId, city, and state are required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const results: Array<Record<string, unknown>> = [];

    // ── Source 1: Apollo people search ──────────────────────────────────────
    let apolloPeople: Array<Record<string, unknown>> = [];
    try {
      // perPage 50 since we'll filter to email-only, so we get ~25 usable results
      const apolloData = await searchPeopleByCity({ city, state, page, perPage: 50 });
      apolloPeople = (apolloData.people ?? apolloData.contacts ?? [])
        // Only keep people where Apollo already has an email — no credit spent
        .filter((p: Record<string, unknown>) => p.email && p.email !== '');
    } catch (e) {
      console.error('Apollo people search error:', e);
    }

    for (const person of apolloPeople) {
      const org = (person.organization as Record<string, unknown>) ?? {};
      const enrichScore = await scoreProspect({
        title: (person.title as string) ?? '',
        company: (org.name as string) ?? '',
        employeeCount: (org.num_employees as number) ?? undefined,
        website: (org.website_url as string) ?? undefined,
        location: `${city}, ${state}`,
      }).catch(() => ({ score: 50, notes: '', recommended: true }));

      results.push({
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
        qualification_score: enrichScore.score,
        qualification_notes: enrichScore.notes,
        campaign_id: campaignId,
        status: enrichScore.recommended ? 'qualified' : 'new',
      });
    }

    // ── Source 2: Ahrefs — top-ranking PM domains in city ───────────────────
    let ahrefsResults: Array<Record<string, unknown>> = [];
    try {
      const ahrefsData = await findRankingPMSitesForCity(city, state);
      const seen = new Set<string>();
      for (const kw of ahrefsData) {
        for (const domain of kw.domains) {
          if (!seen.has(domain.domain)) {
            seen.add(domain.domain);
            ahrefsResults.push({
              company_website: `https://${domain.domain}`,
              company: domain.domain.replace('www.', '').replace('.com', '').replace('.net', ''),
              city,
              state,
              source: 'ahrefs',
              campaign_id: campaignId,
              status: 'new',
              qualification_score: Math.min(90, 40 + (domain.traffic ?? 0) / 100),
              qualification_notes: `Ranking for "${kw.keyword}" — estimated traffic ${domain.traffic ?? 'unknown'}`,
              enrichment_data: { ahrefs_position: domain.position, ahrefs_keyword: kw.keyword },
            });
          }
        }
      }
    } catch (e) {
      console.error('Ahrefs search error:', e);
    }

    const allProspects = [...results, ...ahrefsResults];

    // ── De-duplicate by email/domain before inserting ────────────────────────
    const { data: existing } = await supabase
      .from('prospects')
      .select('email, company_website')
      .eq('campaign_id', campaignId);

    const existingEmails = new Set((existing ?? []).map((p) => p.email).filter(Boolean));
    const existingDomains = new Set((existing ?? []).map((p) => p.company_website).filter(Boolean));

    const fresh = allProspects.filter((p) => {
      if (p.email && existingEmails.has(p.email)) return false;
      if (p.company_website && existingDomains.has(p.company_website)) return false;
      return true;
    });

    // ── Upsert to Supabase ───────────────────────────────────────────────────
    if (fresh.length > 0) {
      await supabase.from('prospects').insert(fresh);

      // Update campaign counts
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
      total_found: allProspects.length,
      duplicates_skipped: allProspects.length - fresh.length,
      sources: {
        apollo: apolloPeople.length,
        ahrefs: ahrefsResults.length,
      },
    });
  } catch (error) {
    console.error('Discover error:', error);
    return NextResponse.json({ error: 'Discovery failed', detail: String(error) }, { status: 500 });
  }
}
