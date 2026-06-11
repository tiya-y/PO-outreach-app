export type ProspectStatus =
  | 'new'
  | 'qualified'
  | 'disqualified'
  | 'contacted'
  | 'replied'
  | 'meeting_booked'
  | 'closed_won'
  | 'closed_lost';

export type CampaignStatus = 'active' | 'paused' | 'completed';

export type EmailStatus = 'draft' | 'scheduled' | 'sent' | 'opened' | 'replied' | 'bounced';

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type ReplyClassification =
  | 'interested'
  | 'meeting_request'
  | 'more_info'
  | 'not_interested'
  | 'do_not_contact'
  | 'wrong_person'
  | 'auto_reply';

export interface Campaign {
  id: string;
  name: string;
  city: string;
  state: string;
  target_role: string[];
  min_units: number;
  compensation: string | null;
  status: CampaignStatus;
  prospect_count: number;
  qualified_count: number;
  contacted_count: number;
  meeting_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  campaign_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  company_website: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  portfolio_size: number | null;
  company_employee_count: number | null;
  years_in_business: number | null;
  source: string | null;
  apollo_id: string | null;
  apollo_org_id: string | null;
  qualification_score: number;
  qualification_notes: string | null;
  disqualify_reason: string | null;
  enrichment_data: Record<string, unknown>;
  status: ProspectStatus;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachEmail {
  id: string;
  prospect_id: string;
  campaign_id: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  sequence_step: number;
  status: EmailStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  brevo_message_id: string | null;
  apollo_email_id: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface Reply {
  id: string;
  prospect_id: string;
  outreach_email_id: string | null;
  raw_content: string;
  classification: ReplyClassification | null;
  confidence: number | null;
  suggested_response: string | null;
  handled: boolean;
  handled_at: string | null;
  response_sent: string | null;
  received_at: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  prospect_id: string;
  campaign_id: string | null;
  sales_rep_email: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  ms_event_id: string | null;
  brief_markdown: string | null;
  brief_generated_at: string | null;
  status: MeetingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  prospect?: Prospect;
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  ms365_user_id: string | null;
  ms365_access_token: string | null;
  ms365_refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface PipelineStats {
  total: number;
  new: number;
  qualified: number;
  contacted: number;
  replied: number;
  meeting_booked: number;
  closed_won: number;
  closed_lost: number;
}
