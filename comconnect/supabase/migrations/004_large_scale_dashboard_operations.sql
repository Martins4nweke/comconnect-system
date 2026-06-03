-- ComConnect Phase 4 V3: Large-Scale Dashboard Operations
-- Additive migration. Run after Phase 1 V4, Phase 2 V3, Phase 3 V3.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Archive metadata
-- ------------------------------------------------------------
alter table public.participants add column if not exists archived_at timestamptz;
alter table public.participants add column if not exists archived_by uuid;

alter table public.participant_groups add column if not exists archived_at timestamptz;
alter table public.participant_groups add column if not exists archived_by uuid;

alter table public.education_items add column if not exists archived_at timestamptz;
alter table public.education_items add column if not exists archived_by uuid;

alter table public.questionnaires add column if not exists archived_at timestamptz;
alter table public.questionnaires add column if not exists archived_by uuid;

alter table public.consent_forms add column if not exists archived_at timestamptz;
alter table public.consent_forms add column if not exists archived_by uuid;

alter table public.health_observations add column if not exists archived_at timestamptz;
alter table public.health_observations add column if not exists archived_by uuid;

alter table public.appointments add column if not exists archived_at timestamptz;
alter table public.appointments add column if not exists archived_by uuid;

alter table public.referrals add column if not exists archived_at timestamptz;
alter table public.referrals add column if not exists archived_by uuid;

alter table public.help_requests add column if not exists archived_at timestamptz;
alter table public.help_requests add column if not exists archived_by uuid;

alter table public.inbox_items add column if not exists archived_at timestamptz;
alter table public.inbox_items add column if not exists archived_by uuid;

alter table public.chat_threads add column if not exists archived_at timestamptz;
alter table public.chat_threads add column if not exists archived_by uuid;

alter table public.push_notification_queue add column if not exists archived_at timestamptz;
alter table public.push_notification_queue add column if not exists archived_by uuid;

alter table public.voice_call_tasks add column if not exists archived_at timestamptz;
alter table public.voice_call_tasks add column if not exists archived_by uuid;

-- ------------------------------------------------------------
-- Large-table indexes
-- ------------------------------------------------------------

-- Participants: 2M+ records
create index if not exists idx_participants_project_created_desc on public.participants(project_id, created_at desc);
create index if not exists idx_participants_project_status_created on public.participants(project_id, status, created_at desc);
create index if not exists idx_participants_org_project_created on public.participants(organisation_id, project_id, created_at desc);
create index if not exists idx_participants_project_app_access on public.participants(project_id, app_access_enabled);
create index if not exists idx_participants_archived_at on public.participants(archived_at);

-- Groups
create index if not exists idx_participant_groups_project_status_created on public.participant_groups(project_id, status, created_at desc);

-- Education
create index if not exists idx_education_items_project_status_created on public.education_items(project_id, status, created_at desc);
create index if not exists idx_education_items_project_category on public.education_items(project_id, category);
create index if not exists idx_education_items_archived_at on public.education_items(archived_at);

-- Questionnaires
create index if not exists idx_questionnaires_project_status_created on public.questionnaires(project_id, status, created_at desc);
create index if not exists idx_questionnaires_archived_at on public.questionnaires(archived_at);

-- Consent
create index if not exists idx_consent_forms_project_status_created on public.consent_forms(project_id, status, created_at desc);
create index if not exists idx_participant_consents_project_participant on public.participant_consents(project_id, participant_id);

-- Health observations
create index if not exists idx_health_observations_project_created_desc on public.health_observations(project_id, created_at desc);
create index if not exists idx_health_observations_project_severity_created on public.health_observations(project_id, severity, created_at desc);
create index if not exists idx_health_observations_archived_at on public.health_observations(archived_at);

-- Appointments
create index if not exists idx_appointments_project_status_start on public.appointments(project_id, status, start_at);
create index if not exists idx_appointments_project_start on public.appointments(project_id, start_at);
create index if not exists idx_appointments_archived_at on public.appointments(archived_at);

-- Referrals
create index if not exists idx_referrals_project_status_created on public.referrals(project_id, status, created_at desc);
create index if not exists idx_referrals_project_priority_created on public.referrals(project_id, priority, created_at desc);
create index if not exists idx_referrals_follow_up_at on public.referrals(follow_up_at);
create index if not exists idx_referrals_archived_at on public.referrals(archived_at);

-- Help/inbox/chat
create index if not exists idx_help_requests_project_status_created on public.help_requests(project_id, status, created_at desc);
create index if not exists idx_help_requests_project_priority_created on public.help_requests(project_id, priority, created_at desc);
create index if not exists idx_inbox_items_project_status_created on public.inbox_items(project_id, status, created_at desc);
create index if not exists idx_inbox_items_project_priority_created on public.inbox_items(project_id, priority, created_at desc);
create index if not exists idx_chat_threads_project_status_updated on public.chat_threads(project_id, status, updated_at desc);

-- Push/voice
create index if not exists idx_push_queue_project_status_scheduled on public.push_notification_queue(project_id, status, scheduled_for);
create index if not exists idx_voice_tasks_project_status_created on public.voice_call_tasks(project_id, status, created_at desc);
create index if not exists idx_voice_tasks_project_priority_created on public.voice_call_tasks(project_id, priority, created_at desc);

-- Audit
create index if not exists idx_audit_logs_project_created_desc on public.audit_logs(project_id, created_at desc);
create index if not exists idx_audit_logs_org_created_desc on public.audit_logs(organisation_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------
-- Generic archive helper
-- ------------------------------------------------------------
create or replace function public.set_archive_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' and new.archived_at is null then
    new.archived_at = now();
  end if;
  return new;
end;
$$;

-- Apply archive triggers only where status exists and archived_at exists.
drop trigger if exists trg_participants_archive_metadata on public.participants;
create trigger trg_participants_archive_metadata
before update on public.participants
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_participant_groups_archive_metadata on public.participant_groups;
create trigger trg_participant_groups_archive_metadata
before update on public.participant_groups
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_education_items_archive_metadata on public.education_items;
create trigger trg_education_items_archive_metadata
before update on public.education_items
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_questionnaires_archive_metadata on public.questionnaires;
create trigger trg_questionnaires_archive_metadata
before update on public.questionnaires
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_consent_forms_archive_metadata on public.consent_forms;
create trigger trg_consent_forms_archive_metadata
before update on public.consent_forms
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_appointments_archive_metadata on public.appointments;
create trigger trg_appointments_archive_metadata
before update on public.appointments
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_referrals_archive_metadata on public.referrals;
create trigger trg_referrals_archive_metadata
before update on public.referrals
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_help_requests_archive_metadata on public.help_requests;
create trigger trg_help_requests_archive_metadata
before update on public.help_requests
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_inbox_items_archive_metadata on public.inbox_items;
create trigger trg_inbox_items_archive_metadata
before update on public.inbox_items
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_chat_threads_archive_metadata on public.chat_threads;
create trigger trg_chat_threads_archive_metadata
before update on public.chat_threads
for each row execute function public.set_archive_metadata();

drop trigger if exists trg_voice_tasks_archive_metadata on public.voice_call_tasks;
create trigger trg_voice_tasks_archive_metadata
before update on public.voice_call_tasks
for each row execute function public.set_archive_metadata();
