import axios from 'axios';

const AHREFS_BASE = 'https://api.ahrefs.com/v3';

const ahrefsClient = axios.create({
  baseURL: AHREFS_BASE,
  headers: {
    Authorization: `Bearer ${process.env.AHREFS_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// ── Domain overview — find top-ranking property management sites ──────────────

export async function searchTopDomainsByKeyword(params: {
  keyword: string;
  country?: string;
  limit?: number;
}) {
  try {
    // Ahrefs Keywords Explorer — top ranking pages for a keyword
    const res = await ahrefsClient.get('/keywords-explorer/overview', {
      params: {
        keywords: params.keyword,
        country: params.country ?? 'us',
        select: 'keyword,volume,cpc,clicks',
        limit: params.limit ?? 20,
      },
    });
    return res.data;
  } catch {
    return null;
  }
}

// Find property management companies ranking for city-specific keywords
export async function findRankingPMSitesForCity(city: string, state: string) {
  const keywords = [
    `property management ${city}`,
    `property manager ${city} ${state}`,
    `rental property management ${city}`,
    `property management company ${city}`,
    `${city} landlord services`,
  ];

  const results: Array<{ keyword: string; domains: Array<{ domain: string; position: number; traffic: number }> }> = [];

  for (const keyword of keywords) {
    try {
      const res = await ahrefsClient.get('/serp-overview', {
        params: {
          keyword,
          country: 'us',
          select: 'url,domain,position,traffic',
          limit: 10,
        },
      });

      if (res.data?.serp) {
        results.push({
          keyword,
          domains: res.data.serp
            .filter((item: { domain: string }) => !isGenericDomain(item.domain))
            .map((item: { domain: string; position: number; traffic: number }) => ({
              domain: item.domain,
              position: item.position,
              traffic: item.traffic,
            })),
        });
      }
    } catch {
      // Skip keyword if Ahrefs quota exceeded or error
    }
  }

  return results;
}

// Get domain metrics (DR, traffic) for a list of websites
export async function getDomainMetrics(domains: string[]) {
  try {
    const res = await ahrefsClient.get('/batch-domain-overview', {
      params: {
        targets: domains.join(','),
        select: 'domain,dr,org_keywords,org_traffic',
      },
    });
    return res.data.domains;
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isGenericDomain(domain: string): boolean {
  const generic = [
    'yelp.com', 'google.com', 'zillow.com', 'apartments.com',
    'realtor.com', 'trulia.com', 'craigslist.org', 'facebook.com',
    'linkedin.com', 'yellowpages.com', 'bbb.org', 'angi.com',
    'homeadvisor.com', 'buildium.com', 'appfolio.com', 'turbotenant.com',
    'rentec.com', 'propertyware.com', 'doorloop.com', 'costar.com',
  ];
  return generic.some((g) => domain.includes(g));
}
