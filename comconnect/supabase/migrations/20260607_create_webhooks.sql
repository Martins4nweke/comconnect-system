create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,

  name text not null,
  url text not null,
  event_types jsonb not null default '[]'::jsonb,
  secret text not null,

  status text not null default 'active'
    check (status in ('active', 'disabled', 'failed')),

  last_delivery_status text null,
  last_delivery_at timestamptz null,
  last_error text null,

  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists webhooks_organisation_id_idx
  on public.webhooks(organisation_id);

create index if not exists webhooks_project_id_idx
  on public.webhooks(project_id);

create index if not exists webhooks_status_idx
  on public.webhooks(status);

create index if not exists webhooks_created_by_idx
  on public.webhooks(created_by);