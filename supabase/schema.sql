-- ============================================================
-- Innago PO Outreach System — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- CAMPAIGNS — one per city/target market
-- ============================================================
create table if not exists campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text not null,
  state         text not null,
  target_role   text[] default array['Property Manager','Property Owner','Landlord','Real Estate Investor'],
  min_units     int default 5,
  compensation  text,                          -- e.g. "3 months free + free migration"
  status        text default 'active',         -- active | paused | completed
  prospect_count int default 0,
  qualified_count int default 0,
  contacted_count int default 0,
  meeting_count int default 0,
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- PROSPECTS — property owners / managers discovered
-- ============================================================
create table if not exists prospects (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references campaigns(id) on delete cascade,

  -- Identity
  first_name          text,
  last_name           text,
  email               text,
  phone               text,
  title               text,
  company             text,
  company_website     text,
  linkedin_url        text,

  -- Location
  city                text,
  state               text,

  -- Portfolio signals
  portfolio_size      int,                     -- estimated units managed
  company_employee_count int,
  years_in_business   int,

  -- Source
  source              text,                    -- apollo | ahrefs | manual
  apollo_id           text,
  apollo_org_id       text,

  -- Qualification
  qualification_score int default 0,          -- 0-100
  qualification_notes text,
  disqualify_reason   text,

  -- Enrichment
  enrichment_data     jsonb default '{}',

  -- Pipeline status
  status              text default 'new',      -- new | qualified | disqualified | contacted | replied | meeting_booked | closed_won | closed_lost

  -- Timestamps
  last_contacted_at   timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists prospects_campaign_id_idx on prospects(campaign_id);
create index if not exists prospects_status_idx on prospects(status);
create index if not exists prospects_email_idx on prospects(email);

-- ============================================================
-- OUTREACH EMAILS — every email sent or drafted
-- ============================================================
create table if not exists outreach_emails (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete cascade,

  -- Content
  subject             text not null,
  body_html           text,
  body_text           text,
  sequence_step       int default 1,          -- 1=initial, 2-5=follow-ups

  -- Sending
  status              text default 'draft',   -- draft | scheduled | sent | opened | replied | bounced
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,

  -- External IDs
  brevo_message_id    text,
  apollo_email_id     text,

  -- Metadata
  ai_generated        boolean default true,
  created_at          timestamptz default now()
);

create index if not exists emails_prospect_id_idx on outreach_emails(prospect_id);
create index if not exists emails_status_idx on outreach_emails(status);

-- ============================================================
-- REPLIES — inbound emails from prospects
-- ============================================================
create table if not exists replies (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  outreach_email_id   uuid references outreach_emails(id),

  raw_content         text,

  -- AI classification
  classification      text,                   -- interested | not_interested | more_info | wrong_person | do_not_contact | auto_reply
  confidence          numeric(3,2),
  suggested_response  text,

  -- Handling
  handled             boolean default false,
  handled_at          timestamptz,
  response_sent       text,

  received_at         timestamptz default now(),
  created_at          timestamptz default now()
);

-- ============================================================
-- MEETINGS — booked demos
-- ============================================================
create table if not exists meetings (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  campaign_id         uuid references campaigns(id),

  -- Scheduling
  sales_rep_email     text not null,
  scheduled_at        timestamptz not null,
  duration_minutes    int default 30,
  meeting_link        text,                   -- Zoom/Teams link

  -- MS365
  ms_event_id         text,
  ms_calendar_id      text,

  -- Pre-call brief
  brief_markdown      text,
  brief_generated_at  timestamptz,

  -- Status
  status              text default 'scheduled', -- scheduled | completed | cancelled | no_show

  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists meetings_scheduled_at_idx on meetings(scheduled_at);
create index if not exists meetings_sales_rep_idx on meetings(sales_rep_email);

-- ============================================================
-- SEQUENCES — Apollo/Brevo sequence tracking
-- ============================================================
create table if not exists sequences (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references campaigns(id),
  prospect_id         uuid references prospects(id),

  apollo_sequence_id  text,
  brevo_automation_id text,

  current_step        int default 1,
  total_steps         int default 5,
  status              text default 'active',  -- active | paused | completed | unsubscribed

  started_at          timestamptz default now(),
  next_touch_at       timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now()
);

-- ============================================================
-- SALES REPS — internal team members
-- ============================================================
create table if not exists sales_reps (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text unique not null,
  ms365_user_id       text,
  ms365_access_token  text,
  ms365_refresh_token text,
  token_expires_at    timestamptz,
  is_active           boolean default true,
  created_at          timestamptz default now()
);

-- ============================================================
-- Helper function: update updated_at on row change
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at_column();

create trigger update_prospects_updated_at
  before update on prospects
  for each row execute function update_updated_at_column();

create trigger update_meetings_updated_at
  before update on meetings
  for each row execute function update_updated_at_column();

-- ============================================================
-- Row Level Security (basic — open for now, lock down per team)
-- ============================================================
alter table campaigns enable row level security;
alter table prospects enable row level security;
alter table outreach_emails enable row level security;
alter table replies enable row level security;
alter table meetings enable row level security;
alter table sequences enable row level security;
alter table sales_reps enable row level security;

-- Allow all authenticated users full access (tighten per team later)
create policy "authenticated users full access" on campaigns for all using (true);
create policy "authenticated users full access" on prospects for all using (true);
create policy "authenticated users full access" on outreach_emails for all using (true);
create policy "authenticated users full access" on replies for all using (true);
create policy "authenticated users full access" on meetings for all using (true);
create policy "authenticated users full access" on sequences for all using (true);
create policy "authenticated users full access" on sales_reps for all using (true);
