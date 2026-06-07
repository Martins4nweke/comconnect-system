create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,

  name text not null,
  key_prefix text not null,
  key_hash text not null,

  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),

  scopes jsonb not null default '[]'::jsonb,

  created_by uuid null,
  last_used_at timestamptz null,
  expires_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists api_keys_key_prefix_idx
  on public.api_keys(key_prefix);

create index if not exists api_keys_organisation_id_idx
  on public.api_keys(organisation_id);

create index if not exists api_keys_project_id_idx
  on public.api_keys(project_id);

create index if not exists api_keys_status_idx
  on public.api_keys(status);

create index if not exists api_keys_created_by_idx
  on public.api_keys(created_by);