import { NextRequest, NextResponse } from 'next/server';
import { searchPeopleByCity, searchCompaniesByCity } from '@/lib/apollo';
import { findRankingPMSitesForCity } from '@/lib/ahrefs';
import { scoreProspect } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

// Preview discovery — returns prospects WITHOUT saving to DB
export async function POST(req: NextRequest) {
  try {
    const { campaignId, city, state, page = 1 } = await req.json();
    if (!city || !state) {
      return NextResponse.json({ error: 'city and state are required' }, { status: 400 });
    }

    const results: Array<Record<string, unknown>> = [];
    const sources = { apollo: 0, ahrefs: 0 };

    // ── Apollo people search ─────────────────────────────────────────────────
    try {
      const apolloData = await searchPeopleByCity({ city, state, page, perPage: 25 });
      const people = apolloData.people ?? [];
      sources.apollo = people.length;

      for (const person of people) {
        const org = (person.organization as Record<string, unknown>) ?? {};
        const score = await scoreProspect({
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
          title: person.title,
          company: (org.name as string) ?? null,
          company_website: (org.website_url as string) ?? null,
          linkedin_url: person.linkedin_url,
          city,
          state,
          company_employee_count: (org.num_employees as number) ?? null,
          source: 'apollo',
          apollo_id: person.id,
          qualification_score: score.score,
          qualification_notes: score.notes,
          recommended: score.recommended,
          _preview: true,
        });
      }
    } catch (e) {
      console.error('Apollo preview error:', e);
    }

    // ── Ahrefs top-ranking PM domains ────────────────────────────────────────
    try {
      const ahrefsData = await findRankingPMSitesForCity(city, state);
      const seen = new Set<string>();
      for (const kw of ahrefsData) {
        for (const domain of kw.domains) {
          if (!seen.has(domain.domain)) {
            seen.add(domain.domain);
            sources.ahrefs++;
            results.push({
              company_website: `https://${domain.domain}`,
              company: domain.domain.replace('www.', '').replace(/\.(com|net|org)$/, ''),
              city,
              state,
              source: 'ahrefs',
              qualification_score: Math.min(90, 40 + (domain.traffic ?? 0) / 100),
              qualification_notes: `Ranking for "${kw.keyword}"`,
              enrichment_data: { ahrefs_position: domain.position, keyword: kw.keyword },
              recommended: true,
              _preview: true,
            });
          }
        }
      }
    } catch (e) {
      console.error('Ahrefs preview error:', e);
    }

    // Check which are already in DB (for duplicate flagging)
    let existingEmails = new Set<string>();
    let existingDomains = new Set<string>();
    if (campaignId) {
      const supabase = createServiceClient();
      const { data: existing } = await supabase
        .from('prospects')
        .select('email, company_website')
        .eq('campaign_id', campaignId);
      existingEmails = new Set((existing ?? []).map((p) => p.email).filter(Boolean));
      existingDomains = new Set((existing ?? []).map((p) => p.company_website).filter(Boolean));
    }

    // Flag duplicates
    const annotated = results.map((p) => ({
      ...p,
      _duplicate: Boolean(
        (p.email && existingEmails.has(p.email as string)) ||
        (p.company_website && existingDomains.has(p.company_website as string))
      ),
    }));

    const fresh = annotated.filter((p) => !p._duplicate);
    const duplicates = annotated.filter((p) => p._duplicate);

    return NextResponse.json({
      prospects: annotated,
      summary: {
        total: results.length,
        fresh: fresh.length,
        duplicates: duplicates.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        qualified: fresh.filter((p) => (p as any).recommended).length,
        sources,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Preview failed', detail: String(error) }, { status: 500 });
  }
}
