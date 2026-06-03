export type AssignmentTarget = {
  participant_id?: string | null;
  group_id?: string | null;
};

export type ProjectScopedInput = {
  project_id: string;
};

export type ParticipantSubmissionContext = {
  organisation_id: string;
  project_id: string;
  participant_id: string;
  session_id?: string;
  device_id?: string | null;
};

export type JsonObject = Record<string, unknown>;
