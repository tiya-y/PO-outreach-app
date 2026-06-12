import { NextRequest, NextResponse } from 'next/server';
import { enrichPerson, enrichOrganization } from '@/lib/apollo';
import { getDomainMetrics } from '@/lib/ahrefs';
import { scoreProspect } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { prospectId } = await req.json();
    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const updates: Record<string, unknown> = {};
    const signals: Record<string, unknown> = {};

    // ── 1. Apollo person enrichment ──────────────────────────────────────────
    if (prospect.email || prospect.linkedin_url) {
      try {
        const person = await enrichPerson({
          email: prospect.email ?? undefined,
          linkedin_url: prospect.linkedin_url ?? undefined,
          first_name: prospect.first_name ?? undefined,
          last_name: prospect.last_name ?? undefined,
          organization_name: prospect.company ?? undefined,
        });

        if (person) {
          updates.phone = person.sanitized_phone ?? prospect.phone;
          updates.linkedin_url = person.linkedin_url ?? prospect.linkedin_url;
          if (person.employment_history?.length > 0) {
            updates.years_in_business = person.employment_history.length;
            signals.years_in_business = person.employment_history.length;
          }
          signals.apollo_person = {
            title: person.title,
            seniority: person.seniority,
            departments: person.departments,
          };
        }
      } catch (e) {
        console.error('Person enrichment error:', e);
      }
    }

    // ── 2. Apollo org enrichment ─────────────────────────────────────────────
    if (prospect.company_website) {
      try {
        const domain = new URL(prospect.company_website).hostname.replace('www.', '');
        const org = await enrichOrganization(domain);

        if (org) {
          updates.company = org.name ?? prospect.company;
          updates.company_employee_count = org.num_employees ?? prospect.company_employee_count;
          const estimated = estimatePortfolioFromEmployees(org.num_employees);
          if (estimated) updates.portfolio_size = estimated;

          signals.employee_count = org.num_employees;
          signals.estimated_units = estimated;
          signals.founded_year = org.founded_year;
          signals.annual_revenue_usd = org.annual_revenue_usd;
          signals.industry = org.industry;
          signals.short_description = org.short_description;
        }
      } catch (e) {
        console.error('Org enrichment error:', e);
      }
    }

    // ── 3. Ahrefs domain metrics ─────────────────────────────────────────────
    if (prospect.company_website && process.env.AHREFS_API_KEY) {
      try {
        const domain = new URL(prospect.company_website).hostname.replace('www.', '');
        const metrics = await getDomainMetrics([domain]);
        const m = metrics?.[0];

        if (m) {
          signals.domain_rating = m.dr;
          signals.organic_keywords = m.org_keywords;
          signals.organic_traffic = m.org_traffic;

          // High DR / traffic = established business with real web presence
          if (m.dr >= 20 || m.org_traffic >= 500) {
            signals.web_presence = 'strong';
          } else if (m.dr >= 10 || m.org_traffic >= 100) {
            signals.web_presence = 'moderate';
          } else {
            signals.web_presence = 'minimal';
          }
        }
      } catch (e) {
        console.error('Ahrefs enrichment error:', e);
      }
    }

    // ── 4. Claude scoring (with all signals) ─────────────────────────────────
    try {
      const scored = await scoreProspect({
        title: prospect.title ?? '',
        company: (updates.company as string) ?? prospect.company ?? '',
        employeeCount: (signals.employee_count as number) ?? prospect.company_employee_count ?? undefined,
        website: prospect.company_website ?? undefined,
        location: `${prospect.city}, ${prospect.state}`,
        signals, // pass all enrichment signals to Claude
      });

      updates.qualification_score = scored.score;
      updates.qualification_notes = scored.notes;
      updates.status = scored.recommended ? 'qualified' : prospect.status;
    } catch (e) {
      console.error('Scoring error:', e);
    }

    // ── Save enrichment data ─────────────────────────────────────────────────
    updates.enrichment_data = {
      ...(prospect.enrichment_data ?? {}),
      ...signals,
      enriched_at: new Date().toISOString(),
    };

    if (Object.keys(updates).length > 0) {
      await supabase.from('prospects').update(updates).eq('id', prospectId);
    }

    return NextResponse.json({
      success: true,
      updated_fields: Object.keys(updates),
      score: updates.qualification_score,
      signals,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Enrichment failed', detail: String(error) }, { status: 500 });
  }
}

function estimatePortfolioFromEmployees(employees?: number): number | null {
  if (!employees) return null;
  return Math.round(employees * 10);
}
