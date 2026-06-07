create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  api_key_id uuid null references public.api_keys(id) on delete set null,

  endpoint text not null,
  method text not null,
  status_code integer not null,
  duration_ms integer null,

  request_source text not null default 'dashboard'
    check (request_source in ('dashboard', 'external_api', 'webhook', 'system')),

  channel text null
    check (
      channel is null
      or channel in ('app', 'push', 'sms', 'voice', 'whatsapp', 'email', 'webhook')
    ),

  paid_channel boolean not null default false,
  wallet_transaction_id uuid null references public.wallet_transactions(id) on delete set null,

  error_message text null,

  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists api_usage_logs_organisation_id_idx
  on public.api_usage_logs(organisation_id);

create index if not exists api_usage_logs_project_id_idx
  on public.api_usage_logs(project_id);

create index if not exists api_usage_logs_api_key_id_idx
  on public.api_usage_logs(api_key_id);

create index if not exists api_usage_logs_endpoint_idx
  on public.api_usage_logs(endpoint);

create index if not exists api_usage_logs_status_code_idx
  on public.api_usage_logs(status_code);

create index if not exists api_usage_logs_created_at_idx
  on public.api_usage_logs(created_at desc);

create index if not exists api_usage_logs_paid_channel_idx
  on public.api_usage_logs(paid_channel);