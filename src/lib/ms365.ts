import axios from 'axios';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Build a Graph client with a given access token
function graphClient(accessToken: string) {
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

// ── OAuth token refresh ────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.MS365_CLIENT_ID!,
      client_secret: process.env.MS365_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Calendars.ReadWrite User.Read offline_access',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

// ── Find free slots on a sales rep's calendar ─────────────────────────────────

export async function findAvailableSlots(accessToken: string, daysAhead = 7) {
  const client = graphClient(accessToken);
  const start = new Date();
  const end = new Date(Date.now() + daysAhead * 86400000);

  const res = await client.post('/me/calendar/getSchedule', {
    schedules: [], // empty = check own calendar
    startTime: { dateTime: start.toISOString(), timeZone: 'UTC' },
    endTime: { dateTime: end.toISOString(), timeZone: 'UTC' },
    availabilityViewInterval: 30,
  });

  return res.data;
}

// ── Get upcoming calendar events ──────────────────────────────────────────────

export async function getCalendarEvents(accessToken: string) {
  const client = graphClient(accessToken);
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 14 * 86400000).toISOString();

  const res = await client.get(`/me/calendar/events?$filter=start/dateTime ge '${now}' and start/dateTime le '${future}'&$orderby=start/dateTime&$top=20`);
  return res.data.value;
}

// ── Book a meeting on the sales rep's calendar ────────────────────────────────

export interface BookMeetingParams {
  accessToken: string;
  subject: string;
  startTime: string;       // ISO 8601
  endTime: string;         // ISO 8601
  attendeeEmails: string[];
  bodyHtml: string;
  location?: string;
  onlineMeetingRequired?: boolean;
}

export async function bookMeeting(params: BookMeetingParams) {
  const client = graphClient(params.accessToken);

  const event = {
    subject: params.subject,
    body: {
      contentType: 'HTML',
      content: params.bodyHtml,
    },
    start: { dateTime: params.startTime, timeZone: 'UTC' },
    end: { dateTime: params.endTime, timeZone: 'UTC' },
    location: { displayName: params.location ?? 'Video Call' },
    attendees: params.attendeeEmails.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    isOnlineMeeting: params.onlineMeetingRequired ?? true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  const res = await client.post('/me/calendar/events', event);
  return res.data;
}

// ── Cancel / delete an event ──────────────────────────────────────────────────

export async function cancelMeeting(accessToken: string, eventId: string, message?: string) {
  const client = graphClient(accessToken);
  await client.post(`/me/calendar/events/${eventId}/cancel`, {
    comment: message ?? 'This meeting has been cancelled.',
  });
}

// ── OAuth authorization URL ───────────────────────────────────────────────────

export function getAuthorizationUrl(state?: string) {
  const params = new URLSearchParams({
    client_id: process.env.MS365_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MS365_REDIRECT_URI!,
    scope: 'Calendars.ReadWrite User.Read offline_access',
    response_mode: 'query',
    ...(state ? { state } : {}),
  });
  return `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.MS365_CLIENT_ID!,
      client_secret: process.env.MS365_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.MS365_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}
