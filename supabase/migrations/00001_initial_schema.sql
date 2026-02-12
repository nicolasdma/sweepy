-- InboxPilot: Initial Database Schema
-- All timestamps use timestamptz (UTC)
-- All tables have RLS enabled

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,

  -- Stripe
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'inactive')),

  -- Trial
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_end timestamptz,

  -- Settings
  categories_to_protect text[] not null default array['personal', 'important'],
  scan_limit_per_day integer not null default 20,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ============================================================
-- USER_SENDER_PROFILES (per-user sender categorization cache)
-- ============================================================
create table public.user_sender_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_address text not null,
  sender_domain text not null,
  sender_name text,

  -- Categorization
  category text not null
    check (category in ('newsletter', 'marketing', 'transactional', 'social', 'notification', 'spam', 'personal', 'important', 'unknown')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  categorized_by text not null
    check (categorized_by in ('heuristic', 'cache', 'llm', 'user_override')),

  -- Unsubscribe info
  has_list_unsubscribe boolean not null default false,
  list_unsubscribe_url text,
  supports_one_click boolean not null default false,

  -- Stats
  email_count integer not null default 0,
  open_rate numeric(4,3) default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, sender_address)
);

create index idx_user_sender_profiles_user_id on public.user_sender_profiles(user_id);
create index idx_user_sender_profiles_lookup on public.user_sender_profiles(user_id, sender_address);

create trigger user_sender_profiles_updated_at
  before update on public.user_sender_profiles
  for each row execute function public.update_updated_at();

-- ============================================================
-- EMAIL_SCANS
-- ============================================================
create table public.email_scans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),

  -- Stats
  total_emails_scanned integer not null default 0,
  resolved_by_heuristic integer not null default 0,
  resolved_by_cache integer not null default 0,
  resolved_by_llm integer not null default 0,
  llm_cost_usd numeric(10,6) not null default 0,
  category_counts jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_email_scans_user_id on public.email_scans(user_id);
create index idx_email_scans_user_created on public.email_scans(user_id, created_at desc);

-- ============================================================
-- SUGGESTED_ACTIONS
-- ============================================================
create table public.suggested_actions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scan_id uuid not null references public.email_scans(id) on delete cascade,

  -- Email reference
  gmail_email_id text not null,
  gmail_thread_id text not null,
  sender_address text not null,
  sender_name text,
  subject_preview text, -- max 100 chars
  email_date timestamptz,

  -- Categorization
  category text not null
    check (category in ('newsletter', 'marketing', 'transactional', 'social', 'notification', 'spam', 'personal', 'important', 'unknown')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  action_type text not null
    check (action_type in ('archive', 'unsubscribe', 'move_to_trash', 'mark_read', 'keep')),
  reasoning text,
  categorized_by text not null
    check (categorized_by in ('heuristic', 'cache', 'llm', 'user_override')),

  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'queued', 'executing', 'executed', 'failed', 'expired')),

  -- TTL
  expires_at timestamptz not null default (now() + interval '7 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_suggested_actions_user_id on public.suggested_actions(user_id);
create index idx_suggested_actions_scan_id on public.suggested_actions(scan_id);
create index idx_suggested_actions_status on public.suggested_actions(user_id, status);
create index idx_suggested_actions_expires on public.suggested_actions(expires_at) where status = 'pending';

create trigger suggested_actions_updated_at
  before update on public.suggested_actions
  for each row execute function public.update_updated_at();

-- ============================================================
-- USER_FEEDBACK
-- ============================================================
create table public.user_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_id uuid not null references public.suggested_actions(id) on delete cascade,

  -- Original categorization
  original_category text not null,
  original_action text not null,
  original_confidence numeric(4,3) not null,

  -- User correction
  user_category text,
  user_action text,
  feedback_type text not null
    check (feedback_type in ('approved', 'rejected', 'corrected')),

  -- Sender info (denormalized for analytics)
  sender_address text not null,
  sender_domain text not null,

  created_at timestamptz not null default now()
);

create index idx_user_feedback_user_id on public.user_feedback(user_id);
create index idx_user_feedback_sender on public.user_feedback(user_id, sender_address);

-- ============================================================
-- ACTION_LOG (audit trail)
-- ============================================================
create table public.action_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  email_id text not null,
  action_type text not null
    check (action_type in ('archive', 'unsubscribe', 'move_to_trash', 'mark_read', 'keep')),
  confidence_score numeric(4,3) not null,
  was_batch_approved boolean not null default false,

  executed_at timestamptz not null default now(),
  result text not null check (result in ('success', 'error')),
  error_message text,

  -- No PII, just hash for debugging
  email_subject_hash text not null -- SHA-256
);

create index idx_action_log_user_id on public.action_log(user_id);
create index idx_action_log_user_executed on public.action_log(user_id, executed_at desc);

-- ============================================================
-- USAGE_TRACKING
-- ============================================================
create table public.usage_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  period_start timestamptz not null,
  period_end timestamptz not null,

  scans_count integer not null default 0,
  emails_processed integer not null default 0,
  llm_calls_count integer not null default 0,
  llm_tokens_used integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, period_start)
);

create index idx_usage_tracking_user_period on public.usage_tracking(user_id, period_start desc);

create trigger usage_tracking_updated_at
  before update on public.usage_tracking
  for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.user_sender_profiles enable row level security;
alter table public.email_scans enable row level security;
alter table public.suggested_actions enable row level security;
alter table public.user_feedback enable row level security;
alter table public.action_log enable row level security;
alter table public.usage_tracking enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User sender profiles
create policy "Users can view own sender profiles"
  on public.user_sender_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own sender profiles"
  on public.user_sender_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sender profiles"
  on public.user_sender_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sender profiles"
  on public.user_sender_profiles for delete
  using (auth.uid() = user_id);

-- Email scans
create policy "Users can view own scans"
  on public.email_scans for select
  using (auth.uid() = user_id);

create policy "Users can insert own scans"
  on public.email_scans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scans"
  on public.email_scans for update
  using (auth.uid() = user_id);

-- Suggested actions
create policy "Users can view own suggested actions"
  on public.suggested_actions for select
  using (auth.uid() = user_id);

create policy "Users can insert own suggested actions"
  on public.suggested_actions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own suggested actions"
  on public.suggested_actions for update
  using (auth.uid() = user_id);

-- User feedback
create policy "Users can view own feedback"
  on public.user_feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert own feedback"
  on public.user_feedback for insert
  with check (auth.uid() = user_id);

-- Action log
create policy "Users can view own action log"
  on public.action_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own action log"
  on public.action_log for insert
  with check (auth.uid() = user_id);

-- Usage tracking
create policy "Users can view own usage"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.usage_tracking for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.usage_tracking for update
  using (auth.uid() = user_id);
