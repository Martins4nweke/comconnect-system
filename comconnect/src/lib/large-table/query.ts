export function applyCommonFilters(query: any, params: {
  projectId?: string | null;
  organisationId?: string | null;
  status?: string | null;
  priority?: string | null;
  cursor?: string | null;
}) {
  let q = query;

  if (params.projectId) q = q.eq("project_id", params.projectId);
  if (params.organisationId) q = q.eq("organisation_id", params.organisationId);
  if (params.status) q = q.eq("status", params.status);
  if (params.priority) q = q.eq("priority", params.priority);
  if (params.cursor) q = q.lt("created_at", params.cursor);

  return q;
}

export function textSearchOr(q: string | null | undefined, fields: string[]) {
  if (!q) return null;
  const safe = q.replace(/[%(),]/g, "").trim();
  if (!safe) return null;
  return fields.map((field) => `${field}.ilike.%${safe}%`).join(",");
}
