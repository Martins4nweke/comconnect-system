import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ memberId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { memberId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("Request body is required");

  const allowed = ["full_name", "role", "status", "email", "user_id"];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = key === "email" ? String(body[key]).trim().toLowerCase() : body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .update(payload)
    .eq("id", memberId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "project_member.updated",
    entity_type: "project_member",
    entity_id: data.id,
    metadata: payload,
  });

  return ok(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { memberId } = await params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("project_members")
    .select("id, organisation_id, project_id, email, role")
    .eq("id", memberId)
    .single();

  if (existingError || !existing) return fail("Project member not found", 404);

  const { error } = await supabaseAdmin
    .from("project_members")
    .delete()
    .eq("id", memberId);

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: existing.organisation_id,
    project_id: existing.project_id,
    actor_type: "dashboard_user",
    action: "project_member.deleted",
    entity_type: "project_member",
    entity_id: existing.id,
    metadata: { email: existing.email, role: existing.role },
  });

  return ok({ deleted: true });
}
