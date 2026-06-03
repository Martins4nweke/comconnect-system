-- ComConnect Phase 2: Participant-App API Foundation
-- Requires Phase 1 V4 core foundation.
-- Run in Supabase SQL Editor after 001_comconnect_core_foundation.sql.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Participant app sessions
-- ------------------------------------------------------------
create table if not exists public.participant_app_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_token_hash text not null unique,
  device_id text,
  platform text,
  app_version text,
  ip_address text,
  user_agent text,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_participant_app_sessions_updated_at on public.participant_app_sessions;
create trigger trg_participant_app_sessions_updated_at
before update on public.participant_app_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_participant_app_sessions_participant_id on public.participant_app_sessions(participant_id);
create index if not exists idx_participant_app_sessions_project_id on public.participant_app_sessions(project_id);
create index if not exists idx_participant_app_sessions_status on public.participant_app_sessions(status);
create index if not exists idx_participant_app_sessions_last_seen_at on public.participant_app_sessions(last_seen_at desc);

-- ------------------------------------------------------------
-- Participant login attempts
-- ------------------------------------------------------------
create table if not exists public.participant_login_attempts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  project_code text,
  participant_code text,
  phone_number text,
  success boolean not null default false,
  failure_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_participant_login_attempts_project_code on public.participant_login_attempts(project_code);
create index if not exists idx_participant_login_attempts_participant_code on public.participant_login_attempts(participant_code);
create index if not exists idx_participant_login_attempts_created_at on public.participant_login_attempts(created_at desc);
create index if not exists idx_participant_login_attempts_rate_limit on public.participant_login_attempts(project_code, participant_code, phone_number, success, created_at desc);

-- ------------------------------------------------------------
-- Participant devices
-- ------------------------------------------------------------
create table if not exists public.participant_devices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  device_id text not null,
  platform text not null default 'unknown',
  app_version text,
  push_token text,
  push_provider text default 'expo',
  notifications_enabled boolean not null default true,
  low_data_mode boolean not null default true,
  last_seen_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, device_id)
);

drop trigger if exists trg_participant_devices_updated_at on public.participant_devices;
create trigger trg_participant_devices_updated_at
before update on public.participant_devices
for each row execute function public.set_updated_at();

create index if not exists idx_participant_devices_participant_id on public.participant_devices(participant_id);
create index if not exists idx_participant_devices_project_id on public.participant_devices(project_id);
create index if not exists idx_participant_devices_push_token on public.participant_devices(push_token);

-- ------------------------------------------------------------
-- App messages
-- Basic shell for Phase 2. Later phases will connect this with scheduler/templates.
-- ------------------------------------------------------------
create table if not exists public.app_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  sender_type text not null default 'system' check (sender_type in ('system', 'study_team', 'staff', 'api_client')),
  sender_user_id uuid,
  sender_display_name text default 'ComConnect Study Team',
  sender_role text,
  title text not null,
  body text,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  media jsonb not null default '{}'::jsonb,
  action_links jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  available_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_messages_updated_at on public.app_messages;
create trigger trg_app_messages_updated_at
before update on public.app_messages
for each row execute function public.set_updated_at();

create index if not exists idx_app_messages_participant_id on public.app_messages(participant_id);
create index if not exists idx_app_messages_project_id on public.app_messages(project_id);
create index if not exists idx_app_messages_available_at on public.app_messages(available_at desc);
create index if not exists idx_app_messages_status on public.app_messages(status);

-- ------------------------------------------------------------
-- App message events
-- ------------------------------------------------------------
create table if not exists public.app_message_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  message_id uuid references public.app_messages(id) on delete cascade,
  device_id text,
  event_type text not null,
  local_id text,
  created_offline_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_app_message_events_message_id on public.app_message_events(message_id);
create index if not exists idx_app_message_events_participant_id on public.app_message_events(participant_id);
create index if not exists idx_app_message_events_event_type on public.app_message_events(event_type);
create index if not exists idx_app_message_events_created_at on public.app_message_events(created_at desc);

-- ------------------------------------------------------------
-- App message replies
-- ------------------------------------------------------------
create table if not exists public.app_message_replies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  message_id uuid references public.app_messages(id) on delete set null,
  local_id text,
  reply_text text,
  reply_payload jsonb not null default '{}'::jsonb,
  created_offline_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_app_message_replies_message_id on public.app_message_replies(message_id);
create index if not exists idx_app_message_replies_participant_id on public.app_message_replies(participant_id);
create index if not exists idx_app_message_replies_created_at on public.app_message_replies(created_at desc);

-- ------------------------------------------------------------
-- Sync events
-- ------------------------------------------------------------
create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_id uuid references public.participant_app_sessions(id) on delete set null,
  device_id text,
  sync_type text not null check (sync_type in ('pull', 'push')),
  item_count integer not null default 0,
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_events_participant_id on public.sync_events(participant_id);
create index if not exists idx_sync_events_project_id on public.sync_events(project_id);
create index if not exists idx_sync_events_created_at on public.sync_events(created_at desc);

-- ------------------------------------------------------------
-- Generic participant app inbox/actions staging
-- Useful for offline sync items that do not yet have module-specific tables.
-- Later module phases can move data into specific tables.
-- ------------------------------------------------------------
create table if not exists public.participant_app_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_id uuid references public.participant_app_sessions(id) on delete set null,
  device_id text,
  local_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_offline_at timestamptz,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_participant_app_events_participant_id on public.participant_app_events(participant_id);
create index if not exists idx_participant_app_events_event_type on public.participant_app_events(event_type);
create index if not exists idx_participant_app_events_created_at on public.participant_app_events(created_at desc);

-- ------------------------------------------------------------
-- RLS enabled. Server API routes use service role.
-- ------------------------------------------------------------
alter table public.participant_app_sessions enable row level security;
alter table public.participant_login_attempts enable row level security;
alter table public.participant_devices enable row level security;
alter table public.app_messages enable row level security;
alter table public.app_message_events enable row level security;
alter table public.app_message_replies enable row level security;
alter table public.sync_events enable row level security;
alter table public.participant_app_events enable row level security;


-- Additional Phase 2 V3 indexes for sync performance
create index if not exists idx_app_messages_participant_updated_at on public.app_messages(participant_id, updated_at desc);
create index if not exists idx_app_message_replies_participant_created_at on public.app_message_replies(participant_id, created_at desc);
create index if not exists idx_app_message_events_participant_created_at on public.app_message_events(participant_id, created_at desc);
