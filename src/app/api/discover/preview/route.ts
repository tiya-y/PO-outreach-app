import { NextRequest, NextResponse } from 'next/server';
import { searchPeopleByCity } from '@/lib/apollo';
import { createServiceClient } from '@/lib/supabase';

// Max execution time hint for Vercel
export const maxDuration = 30;

// Preview discovery — returns prospects WITHOUT saving to DB
export async function POST(req: NextRequest) {
  try {
    const { campaignId, city, state, page = 1 } = await req.json();
    if (!city || !state) {
      return NextResponse.json({ error: 'city and state are required' }, { status: 400 });
    }

    const results: Array<Record<string, unknown>> = [];
    const sources = { apollo: 0, ahrefs: 0 };
    const errors: Record<string, string> = {};

    // ── Apollo people search ─────────────────────────────────────────────────
    try {
      const apolloData = await searchPeopleByCity({ city, state, page, perPage: 25 });
      // Apollo returns results under 'people' or 'contacts' depending on plan/endpoint
      const people = apolloData.people ?? apolloData.contacts ?? [];
      sources.apollo = people.length;

      for (const person of people) {
        const org = (person.organization as Record<string, unknown>) ?? {};
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
          // Scoring happens after import to avoid timeout
          qualification_score: 50,
          qualification_notes: 'Score pending — run enrich to qualify',
          recommended: true,
          _preview: true,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { response?: { status?: number; data?: unknown } })?.response?.status;
      const data = (e as { response?: { status?: number; data?: unknown } })?.response?.data;
      errors.apollo = `${msg} (status: ${status ?? 'N/A'}, response: ${JSON.stringify(data)})`;
      console.error('Apollo preview error:', errors.apollo);
    }

    // ── Ahrefs top-ranking PM domains ────────────────────────────────────────
    // Skipped in preview to avoid timeout — only runs on Direct Import
    if (process.env.AHREFS_API_KEY) {
      try {
        const { findRankingPMSitesForCity } = await import('@/lib/ahrefs');
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
                qualification_score: 70,
                qualification_notes: `Ranking for "${kw.keyword}"`,
                enrichment_data: { ahrefs_position: domain.position, keyword: kw.keyword },
                recommended: true,
                _preview: true,
              });
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.ahrefs = msg;
        console.error('Ahrefs preview error:', errors.ahrefs);
      }
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
      ...(Object.keys(errors).length > 0 && { errors }),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Preview failed', detail: String(error) }, { status: 500 });
  }
}
