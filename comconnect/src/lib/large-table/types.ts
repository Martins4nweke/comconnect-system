export type LargeTableParams = {
  projectId?: string | null;
  organisationId?: string | null;
  q?: string | null;
  status?: string | null;
  priority?: string | null;
  limit: number;
  cursor?: string | null;
};

export type BulkAction = "archive" | "activate" | "deactivate" | "cancel" | "complete" | "resolve" | "assign" | "status";

export type BulkActionPayload = {
  action: BulkAction;
  ids: string[];
  status?: string;
  assigned_user_id?: string | null;
};
