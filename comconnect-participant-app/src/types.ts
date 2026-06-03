export type ModuleCode =
  | "app_messaging"
  | "education"
  | "questionnaires"
  | "consent"
  | "health_checkins"
  | "appointments"
  | "referrals"
  | "help_requests"
  | "chat"
  | "push_notifications"
  | "sms_fallback"
  | "voice_fallback"
  | "whatsapp_optional";

export type ParticipantSession = {
  session_token: string;
  session_id: string;
};

export type ProjectModule = {
  module_code: ModuleCode | string;
  module_name: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
};

export type ParticipantConfig = {
  organisation: {
    id: string;
    name: string;
    slug?: string | null;
    logo_url?: string | null;
    primary_colour?: string | null;
  };
  project: {
    id: string;
    name: string;
    project_code: string;
    default_language?: string;
  };
  participant: {
    id: string;
    participant_code: string;
    display_name?: string | null;
    preferred_language?: string | null;
  };
  modules: ProjectModule[];
  channel_settings?: Record<string, unknown> | null;
  app_defaults?: Record<string, unknown>;
  server_time: string;
};

export type AppMessage = {
  id: string;
  title: string;
  body?: string | null;
  category?: string;
  priority?: string;
  media?: Record<string, unknown>;
  available_at?: string;
};

export type SyncCache = {
  config?: ParticipantConfig;
  messages: AppMessage[];
  education_items: any[];
  questionnaires: any[];
  consent_forms: any[];
  observation_types: any[];
  appointments: any[];
  referrals: any[];
  help_requests: any[];
  chat_updates: any[];
  pulled_at?: string;
};

export type OfflineQueueItem = {
  local_id: string;
  type: string;
  created_offline_at: string;
  payload: Record<string, unknown>;
};
