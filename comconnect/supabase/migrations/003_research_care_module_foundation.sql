-- ComConnect Phase 3: Research + Care Module Foundation
-- Requires Phase 1 V4 and Phase 2 V3.
-- Generic, organisation-aware, project-aware, module-aware, condition-neutral.

create extension if not exists pgcrypto;

-- ============================================================
-- RESEARCH MODULE: EDUCATION
-- ============================================================

create table if not exists public.education_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  category text,
  language text not null default 'en',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  text_content text,
  current_version_id uuid,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_education_items_updated_at on public.education_items;
create trigger trg_education_items_updated_at
before update on public.education_items
for each row execute function public.set_updated_at();

create index if not exists idx_education_items_project_id on public.education_items(project_id);
create index if not exists idx_education_items_status on public.education_items(status);
create index if not exists idx_education_items_language on public.education_items(language);

create table if not exists public.education_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  education_item_id uuid not null references public.education_items(id) on delete cascade,
  version_label text not null default 'v1.0',
  text_content text,
  video_low_url text,
  video_hd_url text,
  audio_url text,
  thumbnail_url text,
  transcript text,
  estimated_data_mb numeric,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (education_item_id, version_label)
);

create index if not exists idx_education_versions_item_id on public.education_versions(education_item_id);
create index if not exists idx_education_versions_project_id on public.education_versions(project_id);

create table if not exists public.education_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  education_item_id uuid not null references public.education_items(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  group_id uuid references public.participant_groups(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  check (
    participant_id is not null or group_id is not null
  )
);

create index if not exists idx_education_assignments_project_id on public.education_assignments(project_id);
create index if not exists idx_education_assignments_participant_id on public.education_assignments(participant_id);
create index if not exists idx_education_assignments_group_id on public.education_assignments(group_id);

create table if not exists public.education_progress (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  education_item_id uuid not null references public.education_items(id) on delete cascade,
  education_version_id uuid references public.education_versions(id) on delete set null,
  progress_status text not null default 'started' check (progress_status in ('started', 'viewed', 'completed')),
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  local_id text,
  created_offline_at timestamptz,
  last_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, education_item_id)
);

drop trigger if exists trg_education_progress_updated_at on public.education_progress;
create trigger trg_education_progress_updated_at
before update on public.education_progress
for each row execute function public.set_updated_at();

create index if not exists idx_education_progress_participant_id on public.education_progress(participant_id);
create index if not exists idx_education_progress_project_id on public.education_progress(project_id);

-- ============================================================
-- RESEARCH MODULE: QUESTIONNAIRES
-- ============================================================

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  language text not null default 'en',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version_label text not null default 'v1.0',
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_questionnaires_updated_at on public.questionnaires;
create trigger trg_questionnaires_updated_at
before update on public.questionnaires
for each row execute function public.set_updated_at();

create index if not exists idx_questionnaires_project_id on public.questionnaires(project_id);
create index if not exists idx_questionnaires_status on public.questionnaires(status);

create table if not exists public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  question_order integer not null default 1,
  question_code text not null,
  question_text text not null,
  question_type text not null check (question_type in ('short_text', 'long_text', 'number', 'yes_no', 'single_choice', 'multiple_choice', 'date', 'rating', 'symptom_checklist', 'measurement')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (questionnaire_id, question_code)
);

create index if not exists idx_questionnaire_questions_questionnaire_id on public.questionnaire_questions(questionnaire_id);

create table if not exists public.questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  group_id uuid references public.participant_groups(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  check (participant_id is not null or group_id is not null)
);

create index if not exists idx_questionnaire_assignments_project_id on public.questionnaire_assignments(project_id);
create index if not exists idx_questionnaire_assignments_participant_id on public.questionnaire_assignments(participant_id);
create index if not exists idx_questionnaire_assignments_group_id on public.questionnaire_assignments(group_id);

create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  local_id text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'reviewed', 'archived')),
  score jsonb not null default '{}'::jsonb,
  created_offline_at timestamptz,
  submitted_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_questionnaire_responses_participant_id on public.questionnaire_responses(participant_id);
create index if not exists idx_questionnaire_responses_project_id on public.questionnaire_responses(project_id);
create index if not exists idx_questionnaire_responses_questionnaire_id on public.questionnaire_responses(questionnaire_id);

-- ============================================================
-- RESEARCH MODULE: CONSENT
-- ============================================================

create table if not exists public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  language text not null default 'en',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_consent_forms_updated_at on public.consent_forms;
create trigger trg_consent_forms_updated_at
before update on public.consent_forms
for each row execute function public.set_updated_at();

create index if not exists idx_consent_forms_project_id on public.consent_forms(project_id);

create table if not exists public.consent_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  consent_form_id uuid not null references public.consent_forms(id) on delete cascade,
  version_label text not null default 'v1.0',
  study_information text,
  privacy_information text,
  risks_benefits text,
  voluntary_participation text,
  contact_details text,
  checkbox_statements jsonb not null default '[]'::jsonb,
  full_text text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (consent_form_id, version_label)
);

create index if not exists idx_consent_versions_form_id on public.consent_versions(consent_form_id);

create table if not exists public.participant_consents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  consent_form_id uuid not null references public.consent_forms(id) on delete cascade,
  consent_version_id uuid not null references public.consent_versions(id) on delete cascade,
  local_id text,
  accepted boolean not null default false,
  typed_name text,
  signature_url text,
  language text,
  created_offline_at timestamptz,
  accepted_at timestamptz,
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (participant_id, consent_version_id)
);

create index if not exists idx_participant_consents_participant_id on public.participant_consents(participant_id);
create index if not exists idx_participant_consents_project_id on public.participant_consents(project_id);

-- ============================================================
-- CARE MODULE: HEALTH CHECK-INS / OBSERVATIONS
-- ============================================================

create table if not exists public.project_observation_types (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  field_schema jsonb not null default '{"fields":[]}'::jsonb,
  validation_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

drop trigger if exists trg_project_observation_types_updated_at on public.project_observation_types;
create trigger trg_project_observation_types_updated_at
before update on public.project_observation_types
for each row execute function public.set_updated_at();

create index if not exists idx_project_observation_types_project_id on public.project_observation_types(project_id);

create table if not exists public.health_observations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  observation_type_id uuid not null references public.project_observation_types(id) on delete restrict,
  observation_code text not null,
  local_id text,
  values_json jsonb not null default '{}'::jsonb,
  severity text not null default 'normal' check (severity in ('normal', 'low', 'moderate', 'high', 'urgent', 'unknown')),
  alert_status text not null default 'none' check (alert_status in ('none', 'created', 'reviewed', 'resolved')),
  created_offline_at timestamptz,
  submitted_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_health_observations_participant_id on public.health_observations(participant_id);
create index if not exists idx_health_observations_project_id on public.health_observations(project_id);
create index if not exists idx_health_observations_observation_type_id on public.health_observations(observation_type_id);
create index if not exists idx_health_observations_severity on public.health_observations(severity);

create table if not exists public.observation_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  observation_type_id uuid not null references public.project_observation_types(id) on delete cascade,
  name text not null,
  rule_json jsonb not null default '{}'::jsonb,
  severity text not null default 'high' check (severity in ('low', 'moderate', 'high', 'urgent')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_observation_alert_rules_updated_at on public.observation_alert_rules;
create trigger trg_observation_alert_rules_updated_at
before update on public.observation_alert_rules
for each row execute function public.set_updated_at();

-- ============================================================
-- CARE MODULE: APPOINTMENTS
-- ============================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  appointment_type text not null default 'follow_up',
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'reschedule_requested', 'cancelled', 'completed', 'missed', 'archived')),
  assigned_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create index if not exists idx_appointments_participant_id on public.appointments(participant_id);
create index if not exists idx_appointments_project_id on public.appointments(project_id);
create index if not exists idx_appointments_start_at on public.appointments(start_at);

create table if not exists public.appointment_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  local_id text,
  response text not null check (response in ('confirmed', 'reschedule_requested', 'cannot_attend')),
  note text,
  requested_new_time timestamptz,
  created_offline_at timestamptz,
  responded_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_appointment_responses_appointment_id on public.appointment_responses(appointment_id);

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  reminder_channel text not null default 'app',
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CARE MODULE: REFERRALS
-- ============================================================

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  referral_type text not null default 'general',
  reason text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'under_review', 'follow_up_scheduled', 'participant_not_ready', 'contacted', 'completed', 'archived')),
  assigned_user_id uuid,
  follow_up_at timestamptz,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_referrals_updated_at on public.referrals;
create trigger trg_referrals_updated_at
before update on public.referrals
for each row execute function public.set_updated_at();

create index if not exists idx_referrals_participant_id on public.referrals(participant_id);
create index if not exists idx_referrals_project_id on public.referrals(project_id);
create index if not exists idx_referrals_status on public.referrals(status);
create index if not exists idx_referrals_priority on public.referrals(priority);

create table if not exists public.referral_followups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  referral_id uuid not null references public.referrals(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  followup_type text not null default 'call',
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'contacted', 'completed', 'failed', 'archived')),
  scheduled_for timestamptz,
  note text,
  assigned_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_referral_followups_updated_at on public.referral_followups;
create trigger trg_referral_followups_updated_at
before update on public.referral_followups
for each row execute function public.set_updated_at();

create table if not exists public.referral_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  referral_id uuid not null references public.referrals(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  note text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CARE MODULE: HELP, CHAT, INBOX
-- ============================================================

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  local_id text,
  category text not null default 'general',
  message text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'assigned', 'resolved', 'archived')),
  assigned_user_id uuid,
  created_offline_at timestamptz,
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

drop trigger if exists trg_help_requests_updated_at on public.help_requests;
create trigger trg_help_requests_updated_at
before update on public.help_requests
for each row execute function public.set_updated_at();

create index if not exists idx_help_requests_participant_id on public.help_requests(participant_id);
create index if not exists idx_help_requests_project_id on public.help_requests(project_id);
create index if not exists idx_help_requests_status on public.help_requests(status);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  subject text,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  assigned_user_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_chat_threads_updated_at on public.chat_threads;
create trigger trg_chat_threads_updated_at
before update on public.chat_threads
for each row execute function public.set_updated_at();

create index if not exists idx_chat_threads_participant_id on public.chat_threads(participant_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  sender_type text not null check (sender_type in ('participant', 'staff', 'system', 'api_client')),
  sender_user_id uuid,
  local_id text,
  message_text text,
  payload jsonb not null default '{}'::jsonb,
  created_offline_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (participant_id, local_id)
);

create index if not exists idx_chat_messages_thread_id on public.chat_messages(thread_id);
create index if not exists idx_chat_messages_participant_id on public.chat_messages(participant_id);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  title text not null,
  summary text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'assigned', 'resolved', 'archived')),
  assigned_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_inbox_items_updated_at on public.inbox_items;
create trigger trg_inbox_items_updated_at
before update on public.inbox_items
for each row execute function public.set_updated_at();

create index if not exists idx_inbox_items_project_id on public.inbox_items(project_id);
create index if not exists idx_inbox_items_status on public.inbox_items(status);
create index if not exists idx_inbox_items_priority on public.inbox_items(priority);

-- ============================================================
-- COMMUNICATION OPERATIONS FOUNDATION
-- ============================================================

create table if not exists public.push_notification_queue (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  device_id uuid references public.participant_devices(id) on delete set null,
  title text not null default 'ComConnect',
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_notification_queue_status on public.push_notification_queue(status);
create index if not exists idx_push_notification_queue_scheduled_for on public.push_notification_queue(scheduled_for);

create table if not exists public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  queue_id uuid references public.push_notification_queue(id) on delete set null,
  provider text,
  provider_message_id text,
  status text not null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fallback_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_fallback_rules_updated_at on public.fallback_rules;
create trigger trg_fallback_rules_updated_at
before update on public.fallback_rules
for each row execute function public.set_updated_at();

create table if not exists public.fallback_message_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  source_type text,
  source_id uuid,
  channel text not null check (channel in ('sms', 'voice', 'whatsapp', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  phone_number text,
  message text,
  provider text,
  provider_message_id text,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.voice_call_tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  phone_number text,
  reason text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'completed', 'failed', 'cancelled')),
  assigned_user_id uuid,
  scheduled_for timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_voice_call_tasks_updated_at on public.voice_call_tasks;
create trigger trg_voice_call_tasks_updated_at
before update on public.voice_call_tasks
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS enabled. Server routes use service role.
-- ============================================================

alter table public.education_items enable row level security;
alter table public.education_versions enable row level security;
alter table public.education_assignments enable row level security;
alter table public.education_progress enable row level security;
alter table public.questionnaires enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_assignments enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.consent_forms enable row level security;
alter table public.consent_versions enable row level security;
alter table public.participant_consents enable row level security;
alter table public.project_observation_types enable row level security;
alter table public.health_observations enable row level security;
alter table public.observation_alert_rules enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_responses enable row level security;
alter table public.appointment_reminders enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_followups enable row level security;
alter table public.referral_notes enable row level security;
alter table public.help_requests enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.inbox_items enable row level security;
alter table public.push_notification_queue enable row level security;
alter table public.push_notification_logs enable row level security;
alter table public.fallback_rules enable row level security;
alter table public.fallback_message_logs enable row level security;
alter table public.sms_logs enable row level security;
alter table public.voice_call_tasks enable row level security;

-- ============================================================
-- PHASE 3 V2 HARDENING: CROSS-PROJECT SAFETY TRIGGERS
-- These protect organisation/project integrity even if a future API
-- or manual insert tries to mix participants/groups from another project.
-- ============================================================

create or replace function public.ensure_participant_scope_match()
returns trigger
language plpgsql
as $$
begin
  if new.participant_id is not null then
    if not exists (
      select 1
      from public.participants p
      where p.id = new.participant_id
        and p.project_id = new.project_id
        and p.organisation_id = new.organisation_id
    ) then
      raise exception 'participant_id does not belong to the same organisation/project';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.ensure_assignment_scope_match()
returns trigger
language plpgsql
as $$
begin
  if new.participant_id is not null then
    if not exists (
      select 1
      from public.participants p
      where p.id = new.participant_id
        and p.project_id = new.project_id
        and p.organisation_id = new.organisation_id
    ) then
      raise exception 'assignment participant_id does not belong to the same organisation/project';
    end if;
  end if;

  if new.group_id is not null then
    if not exists (
      select 1
      from public.participant_groups g
      where g.id = new.group_id
        and g.project_id = new.project_id
        and g.organisation_id = new.organisation_id
    ) then
      raise exception 'assignment group_id does not belong to the same organisation/project';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.ensure_observation_type_scope_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.project_observation_types t
    where t.id = new.observation_type_id
      and t.project_id = new.project_id
      and t.organisation_id = new.organisation_id
  ) then
    raise exception 'observation_type_id does not belong to the same organisation/project';
  end if;

  return new;
end;
$$;

-- Assignment tables with participant_id and/or group_id

drop trigger if exists trg_education_assignments_scope on public.education_assignments;
create trigger trg_education_assignments_scope
before insert or update on public.education_assignments
for each row execute function public.ensure_assignment_scope_match();

drop trigger if exists trg_questionnaire_assignments_scope on public.questionnaire_assignments;
create trigger trg_questionnaire_assignments_scope
before insert or update on public.questionnaire_assignments
for each row execute function public.ensure_assignment_scope_match();

-- Participant-scoped tables

drop trigger if exists trg_education_progress_scope on public.education_progress;
create trigger trg_education_progress_scope
before insert or update on public.education_progress
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_questionnaire_responses_scope on public.questionnaire_responses;
create trigger trg_questionnaire_responses_scope
before insert or update on public.questionnaire_responses
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_participant_consents_scope on public.participant_consents;
create trigger trg_participant_consents_scope
before insert or update on public.participant_consents
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_health_observations_scope on public.health_observations;
create trigger trg_health_observations_scope
before insert or update on public.health_observations
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_health_observations_type_scope on public.health_observations;
create trigger trg_health_observations_type_scope
before insert or update on public.health_observations
for each row execute function public.ensure_observation_type_scope_match();

drop trigger if exists trg_appointments_scope on public.appointments;
create trigger trg_appointments_scope
before insert or update on public.appointments
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_appointment_responses_scope on public.appointment_responses;
create trigger trg_appointment_responses_scope
before insert or update on public.appointment_responses
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_referrals_scope on public.referrals;
create trigger trg_referrals_scope
before insert or update on public.referrals
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_referral_followups_scope on public.referral_followups;
create trigger trg_referral_followups_scope
before insert or update on public.referral_followups
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_referral_notes_scope on public.referral_notes;
create trigger trg_referral_notes_scope
before insert or update on public.referral_notes
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_help_requests_scope on public.help_requests;
create trigger trg_help_requests_scope
before insert or update on public.help_requests
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_chat_threads_scope on public.chat_threads;
create trigger trg_chat_threads_scope
before insert or update on public.chat_threads
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_chat_messages_scope on public.chat_messages;
create trigger trg_chat_messages_scope
before insert or update on public.chat_messages
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_inbox_items_scope on public.inbox_items;
create trigger trg_inbox_items_scope
before insert or update on public.inbox_items
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_push_queue_scope on public.push_notification_queue;
create trigger trg_push_queue_scope
before insert or update on public.push_notification_queue
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_fallback_logs_scope on public.fallback_message_logs;
create trigger trg_fallback_logs_scope
before insert or update on public.fallback_message_logs
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_sms_logs_scope on public.sms_logs;
create trigger trg_sms_logs_scope
before insert or update on public.sms_logs
for each row execute function public.ensure_participant_scope_match();

drop trigger if exists trg_voice_call_tasks_scope on public.voice_call_tasks;
create trigger trg_voice_call_tasks_scope
before insert or update on public.voice_call_tasks
for each row execute function public.ensure_participant_scope_match();

-- Extra performance indexes for mobile sync
create index if not exists idx_education_items_updated_at on public.education_items(updated_at desc);
create index if not exists idx_questionnaires_updated_at on public.questionnaires(updated_at desc);
create index if not exists idx_consent_forms_updated_at on public.consent_forms(updated_at desc);
create index if not exists idx_project_observation_types_updated_at on public.project_observation_types(updated_at desc);
create index if not exists idx_appointments_updated_at on public.appointments(updated_at desc);
create index if not exists idx_referrals_updated_at on public.referrals(updated_at desc);
create index if not exists idx_help_requests_updated_at on public.help_requests(updated_at desc);
create index if not exists idx_chat_threads_updated_at on public.chat_threads(updated_at desc);
