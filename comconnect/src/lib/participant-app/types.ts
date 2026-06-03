export type ParticipantAppSessionContext = {
  session_id: string;
  organisation_id: string;
  project_id: string;
  participant_id: string;
  device_id?: string | null;
  platform?: string | null;
  app_version?: string | null;
};

export type ParticipantAppDeviceInput = {
  device_id?: string;
  platform?: string;
  app_version?: string;
  push_token?: string;
  push_provider?: string;
  notifications_enabled?: boolean;
  low_data_mode?: boolean;
  metadata?: Record<string, unknown>;
};

export type SyncPushItem = {
  local_id: string;
  type: string;
  created_offline_at?: string | null;
  payload?: Record<string, unknown>;
};

export type SyncPullRequest = {
  last_synced_at?: string | null;
};
