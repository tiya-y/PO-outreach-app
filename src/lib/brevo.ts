import axios from 'axios';

const BREVO_BASE = 'https://api.brevo.com/v3';

const brevoClient = axios.create({
  baseURL: BREVO_BASE,
  headers: {
    'accept': 'application/json',
    'content-type': 'application/json',
    'api-key': process.env.BREVO_API_KEY || '',
  },
});

const SENDER = {
  email: process.env.BREVO_SENDER_EMAIL || 'outreach@innago.com',
  name: process.env.BREVO_SENDER_NAME || 'Innago Sales',
};

// ── Send a transactional email ────────────────────────────────────────────────

export async function sendEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
}) {
  const res = await brevoClient.post('/smtp/email', {
    sender: SENDER,
    to: [{ email: params.toEmail, name: params.toName }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    textContent: params.textContent,
    tags: params.tags ?? ['innago-outreach'],
    trackOpens: true,
    trackClicks: true,
  });
  return res.data;
}

// ── Contact management ────────────────────────────────────────────────────────

export async function upsertBrevoContact(params: {
  email: string;
  firstName: string;
  lastName: string;
  attributes?: Record<string, string | number>;
  listIds?: number[];
}) {
  try {
    // Try to update existing contact
    await brevoClient.put(`/contacts/${encodeURIComponent(params.email)}`, {
      attributes: {
        FIRSTNAME: params.firstName,
        LASTNAME: params.lastName,
        ...params.attributes,
      },
      listIds: params.listIds,
    });
  } catch {
    // Create if not found
    await brevoClient.post('/contacts', {
      email: params.email,
      attributes: {
        FIRSTNAME: params.firstName,
        LASTNAME: params.lastName,
        ...params.attributes,
      },
      listIds: params.listIds,
      updateEnabled: true,
    });
  }
}

// ── Get email stats ────────────────────────────────────────────────────────────

export async function getEmailStats(messageId: string) {
  const res = await brevoClient.get('/smtp/statistics/events', {
    params: { messageId, limit: 10 },
  });
  return res.data.events;
}

export async function getContactStats(email: string) {
  const res = await brevoClient.get(`/contacts/${encodeURIComponent(email)}/campaignStats`);
  return res.data;
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns() {
  const res = await brevoClient.get('/emailCampaigns', { params: { limit: 50, status: 'sent' } });
  return res.data.campaigns;
}

// ── Email event report (for tracking opens/replies) ────────────────────────

export async function getEmailEvents(params: { startDate?: string; endDate?: string; email?: string }) {
  const res = await brevoClient.get('/smtp/statistics/events', {
    params: {
      limit: 100,
      ...params,
    },
  });
  return res.data.events;
}
