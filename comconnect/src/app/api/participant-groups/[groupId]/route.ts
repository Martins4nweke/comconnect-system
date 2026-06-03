import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { groupId } = await params;

  const { data, error } = await supabaseAdmin
    .from("participant_groups")
    .select("*, participant_group_memberships(count)")
    .eq("id", groupId)
    .single();

  if (error || !data) return fail("Participant group not found", 404);
  return ok(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("Request body is required");

  const allowed = ["name", "code", "description", "status", "metadata"];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("participant_groups")
    .update(payload)
    .eq("id", groupId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "participant_group.updated",
    entity_type: "participant_group",
    entity_id: data.id,
    metadata: payload,
  });

  return ok(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { groupId } = await params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("participant_groups")
    .select("id, organisation_id, project_id, name")
    .eq("id", groupId)
    .single();

  if (existingError || !existing) return fail("Participant group not found", 404);

  const { error } = await supabaseAdmin
    .from("participant_groups")
    .delete()
    .eq("id", groupId);

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: existing.organisation_id,
    project_id: existing.project_id,
    actor_type: "dashboard_user",
    action: "participant_group.deleted",
    entity_type: "participant_group",
    entity_id: existing.id,
    metadata: { name: existing.name },
  });

  return ok({ deleted: true });
}
