-- ComConnect Phase 1 Core Foundation
-- Run this in Supabase SQL Editor.
-- Generic, organisation-aware, project-aware, and condition-neutral.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  primary_colour text not null default '#F26A21',
  support_email text,
  support_phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_organisations_updated_at on public.organisations;
create trigger trg_organisations_updated_at
before update on public.organisations
for each row execute function public.set_updated_at();

create table if not exists public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid,
  email text,
  full_name text,
  role text not null default 'organisation_admin'
    check (role in ('platform_owner', 'organisation_admin', 'developer', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'inactive', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email)
);

drop trigger if exists trg_organisation_members_updated_at on public.organisation_members;
create trigger trg_organisation_members_updated_at
before update on public.organisation_members
for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  project_code text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  default_language text not null default 'en',
  app_access_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, project_code)
);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create index if not exists idx_projects_organisation_id on public.projects(organisation_id);
create index if not exists idx_projects_project_code on public.projects(project_code);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid,
  email text,
  full_name text,
  role text not null default 'research_assistant'
    check (role in (
      'project_manager',
      'research_assistant',
      'follow_up_officer',
      'clinician',
      'nurse',
      'data_manager',
      'developer',
      'viewer',
      'auditor'
    )),
  status text not null default 'active' check (status in ('active', 'invited', 'inactive', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, email)
);

drop trigger if exists trg_project_members_updated_at on public.project_members;
create trigger trg_project_members_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

create index if not exists idx_project_members_project_id on public.project_members(project_id);

create table if not exists public.project_modules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  module_code text not null,
  module_name text not null,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, module_code)
);

drop trigger if exists trg_project_modules_updated_at on public.project_modules;
create trigger trg_project_modules_updated_at
before update on public.project_modules
for each row execute function public.set_updated_at();

create index if not exists idx_project_modules_project_id on public.project_modules(project_id);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_code text not null,
  phone_number text,
  first_name text,
  last_name text,
  display_name text generated always as (
    nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
  ) stored,
  preferred_language text,
  status text not null default 'active' check (status in ('active', 'inactive', 'withdrawn', 'completed', 'archived')),
  app_access_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, participant_code)
);

drop trigger if exists trg_participants_updated_at on public.participants;
create trigger trg_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

create index if not exists idx_participants_project_id on public.participants(project_id);
create index if not exists idx_participants_phone_number on public.participants(phone_number);
create index if not exists idx_participants_participant_code on public.participants(participant_code);

create table if not exists public.participant_groups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  code text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

drop trigger if exists trg_participant_groups_updated_at on public.participant_groups;
create trigger trg_participant_groups_updated_at
before update on public.participant_groups
for each row execute function public.set_updated_at();

create table if not exists public.participant_group_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.participant_groups(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, participant_id)
);

create index if not exists idx_group_memberships_group_id on public.participant_group_memberships(group_id);
create index if not exists idx_group_memberships_participant_id on public.participant_group_memberships(participant_id);

create table if not exists public.project_channel_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary_channel text not null default 'app' check (primary_channel in ('app', 'sms', 'voice', 'whatsapp', 'email')),
  fallback_order jsonb not null default '["sms", "voice"]'::jsonb,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  voice_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  email_enabled boolean not null default false,
  app_open_timeout_hours integer not null default 24 check (app_open_timeout_hours >= 0),
  urgent_sms_immediate boolean not null default true,
  urgent_voice_immediate boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

drop trigger if exists trg_project_channel_settings_updated_at on public.project_channel_settings;
create trigger trg_project_channel_settings_updated_at
before update on public.project_channel_settings
for each row execute function public.set_updated_at();

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid,
  actor_type text not null default 'system' check (actor_type in ('system', 'dashboard_user', 'participant', 'api_client')),
  actor_label text,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_organisation_id on public.audit_logs(organisation_id);
create index if not exists idx_audit_logs_project_id on public.audit_logs(project_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

create or replace function public.seed_default_project_modules(
  p_organisation_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
as $$
begin
  insert into public.project_modules (organisation_id, project_id, module_code, module_name, enabled, settings)
  values
    (p_organisation_id, p_project_id, 'app_messaging', 'App Messaging', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'education', 'Education Library', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'questionnaires', 'Questionnaires', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'consent', 'Consent', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'health_checkins', 'Health Check-ins', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'appointments', 'Appointments', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'referrals', 'Referrals', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'help_requests', 'Help Requests', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'chat', 'Chat / Replies', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'push_notifications', 'Push Notifications', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'sms_fallback', 'SMS Fallback', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'voice_fallback', 'Voice Fallback', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'whatsapp_optional', 'Optional WhatsApp', false, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'reports', 'Reports', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'exports', 'Exports', true, '{}'::jsonb),
    (p_organisation_id, p_project_id, 'external_api', 'External API', false, '{}'::jsonb)
  on conflict (project_id, module_code) do nothing;

  insert into public.project_channel_settings (organisation_id, project_id)
  values (p_organisation_id, p_project_id)
  on conflict (project_id) do nothing;
end;
$$;



-- Additional Phase 1 integrity indexes for smoother Phase 2 sync/API work
create index if not exists idx_organisation_members_organisation_id on public.organisation_members(organisation_id);
create index if not exists idx_organisation_members_email on public.organisation_members(email);
create index if not exists idx_project_members_organisation_id on public.project_members(organisation_id);
create index if not exists idx_project_modules_organisation_id on public.project_modules(organisation_id);
create index if not exists idx_participants_organisation_id on public.participants(organisation_id);
create index if not exists idx_participants_project_status on public.participants(project_id, status);
create index if not exists idx_participant_groups_organisation_id on public.participant_groups(organisation_id);
create index if not exists idx_participant_groups_project_id on public.participant_groups(project_id);
create index if not exists idx_project_channel_settings_organisation_id on public.project_channel_settings(organisation_id);
create index if not exists idx_project_channel_settings_project_id on public.project_channel_settings(project_id);

-- Prevent cross-project group membership mistakes.
create or replace function public.enforce_group_membership_same_project()
returns trigger
language plpgsql
as $$
declare
  v_group_project_id uuid;
  v_participant_project_id uuid;
  v_group_org_id uuid;
  v_participant_org_id uuid;
begin
  select project_id, organisation_id into v_group_project_id, v_group_org_id
  from public.participant_groups
  where id = new.group_id;

  select project_id, organisation_id into v_participant_project_id, v_participant_org_id
  from public.participants
  where id = new.participant_id;

  if v_group_project_id is null or v_participant_project_id is null then
    raise exception 'Invalid group_id or participant_id for membership';
  end if;

  if v_group_project_id <> v_participant_project_id or v_group_org_id <> v_participant_org_id then
    raise exception 'Participant must belong to the same organisation and project as the group';
  end if;

  new.project_id := v_group_project_id;
  new.organisation_id := v_group_org_id;
  return new;
end;
$$;

drop trigger if exists trg_group_membership_same_project on public.participant_group_memberships;
create trigger trg_group_membership_same_project
before insert or update on public.participant_group_memberships
for each row execute function public.enforce_group_membership_same_project();

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_modules enable row level security;
alter table public.participants enable row level security;
alter table public.participant_groups enable row level security;
alter table public.participant_group_memberships enable row level security;
alter table public.project_channel_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Service role bypasses RLS. Dashboard routes in this pack use service role server-side.
