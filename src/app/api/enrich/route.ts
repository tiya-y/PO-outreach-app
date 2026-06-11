import { NextRequest, NextResponse } from 'next/server';
import { enrichPerson, enrichOrganization } from '@/lib/apollo';
import { createServiceClient } from '@/lib/supabase';

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

    // Enrich person via Apollo
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
          updates.enrichment_data = { ...prospect.enrichment_data, apollo_person: person };
          if (person.employment_history?.length > 0) {
            updates.years_in_business = person.employment_history.length;
          }
        }
      } catch (e) {
        console.error('Person enrichment error:', e);
      }
    }

    // Enrich org via Apollo
    if (prospect.company_website) {
      try {
        const domain = new URL(prospect.company_website).hostname.replace('www.', '');
        const org = await enrichOrganization(domain);

        if (org) {
          updates.company = org.name ?? prospect.company;
          updates.company_employee_count = org.num_employees ?? prospect.company_employee_count;
          updates.portfolio_size = estimatePortfolioFromEmployees(org.num_employees);
          updates.enrichment_data = {
            ...(updates.enrichment_data as Record<string, unknown> ?? prospect.enrichment_data),
            apollo_org: org,
          };
        }
      } catch (e) {
        console.error('Org enrichment error:', e);
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('prospects').update(updates).eq('id', prospectId);
    }

    return NextResponse.json({ success: true, updated_fields: Object.keys(updates) });
  } catch (error) {
    return NextResponse.json({ error: 'Enrichment failed', detail: String(error) }, { status: 500 });
  }
}

// Rough heuristic: PM company with N employees likely manages N*8–15 units
function estimatePortfolioFromEmployees(employees?: number): number | null {
  if (!employees) return null;
  return Math.round(employees * 10);
}
