-- ComConnect Phase 4.6: Dashboard action wiring support
-- Additive. Run after Phase 4 V3 migration if you use fallback rule bulk status/archive.

alter table public.fallback_rules add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive', 'archived'));

alter table public.fallback_rules add column if not exists archived_at timestamptz;
alter table public.fallback_rules add column if not exists archived_by uuid;

create index if not exists idx_fallback_rules_project_status_created
on public.fallback_rules(project_id, status, created_at desc);


-- Phase 4.7 hardening:
-- health_observations originally uses severity/alert_status but not status.
-- Large dashboard archive/status actions need a status column for archive-safe operations.
alter table public.health_observations add column if not exists status text not null default 'active'
  check (status in ('active', 'reviewed', 'resolved', 'archived'));

create index if not exists idx_health_observations_project_status_created
on public.health_observations(project_id, status, created_at desc);

-- fallback_rules page should display and update status, but enabled remains available for rule execution.
update public.fallback_rules
set status = case when enabled then 'active' else 'inactive' end
where status is null;
