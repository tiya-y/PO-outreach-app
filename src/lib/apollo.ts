import axios from 'axios';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

const apolloClient = axios.create({
  baseURL: APOLLO_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Api-Key': process.env.APOLLO_API_KEY || '',
  },
});

// ── Prospect Discovery ────────────────────────────────────────────────────────

export interface ApolloSearchParams {
  city: string;
  state: string;
  titles?: string[];
  minEmployees?: number;
  maxEmployees?: number;
  page?: number;
  perPage?: number;
}

export async function searchPeopleByCity(params: ApolloSearchParams) {
  const { city, state, titles, minEmployees, maxEmployees, page = 1, perPage = 25 } = params;

  const payload: Record<string, unknown> = {
    page,
    per_page: perPage,
    person_titles: titles ?? [
      'Property Manager',
      'Property Owner',
      'Director of Property Management',
      'VP of Property Management',
      'Real Estate Investor',
      'Landlord',
      'Portfolio Manager',
      'Asset Manager',
      'Property Management Company Owner',
    ],
    person_locations: [`${city}, ${state}, United States`],
  };

  if (minEmployees) payload['organization_num_employees_ranges'] = [`${minEmployees},${maxEmployees ?? 10000}`];

  const res = await apolloClient.post('/mixed_people/api_search', payload);

  // Log raw response shape to help debug
  const data = res.data;
  console.log('Apollo raw response keys:', Object.keys(data));
  console.log('Apollo people count:', data?.people?.length ?? data?.contacts?.length ?? 'unknown key');

  return data;
}

export async function searchCompaniesByCity(city: string, state: string) {
  const res = await apolloClient.post('/mixed_companies/api_search', {
    page: 1,
    per_page: 25,
    organization_locations: [`${city}, ${state}`],
    q_organization_keyword_tags: [
      'property management',
      'rental property',
      'real estate investment',
      'multifamily',
      'residential property',
    ],
  });
  return res.data;
}

// ── Enrichment ────────────────────────────────────────────────────────────────

export async function enrichPerson(params: { email?: string; linkedin_url?: string; first_name?: string; last_name?: string; organization_name?: string }) {
  const res = await apolloClient.post('/people/match', {
    ...params,
    reveal_personal_emails: true,
    reveal_phone_number: false,
  });
  return res.data.person;
}

export async function enrichOrganization(domain: string) {
  const res = await apolloClient.post('/organizations/enrich', { domain });
  return res.data.organization;
}

export async function bulkEnrichPeople(details: Array<{ email?: string; first_name?: string; last_name?: string; organization_name?: string }>) {
  const res = await apolloClient.post('/people/bulk_match', {
    details,
    reveal_personal_emails: true,
    reveal_phone_number: false,
  });
  return res.data.matches;
}

// ── Sequences ────────────────────────────────────────────────────────────────

export async function searchSequences() {
  const res = await apolloClient.get('/emailer_campaigns');
  return res.data.emailer_campaigns;
}

export async function addContactToSequence(sequenceId: string, contactIds: string[]) {
  const res = await apolloClient.post(`/emailer_campaigns/${sequenceId}/add_contact_ids`, {
    contact_ids: contactIds,
    send_email_from_email_account_id: undefined, // use default
  });
  return res.data;
}

export async function createContact(data: {
  first_name: string;
  last_name: string;
  email: string;
  title?: string;
  organization_name?: string;
  city?: string;
  state?: string;
}) {
  const res = await apolloClient.post('/contacts', data);
  return res.data.contact;
}
