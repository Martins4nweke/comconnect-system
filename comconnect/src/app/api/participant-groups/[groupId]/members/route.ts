import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { groupId } = await params;

  const { data, error } = await supabaseAdmin
    .from("participant_group_memberships")
    .select("*, participants(*)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  const body = await req.json().catch(() => null);
  const participantIds: string[] = Array.isArray(body?.participant_ids)
    ? body.participant_ids
    : body?.participant_id
      ? [body.participant_id]
      : [];

  if (participantIds.length === 0) return fail("participant_id or participant_ids is required");

  const { data: group, error: groupError } = await supabaseAdmin
    .from("participant_groups")
    .select("id, organisation_id, project_id")
    .eq("id", groupId)
    .single();

  if (groupError || !group) return fail("Group not found", 404);

  const { data: participants, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("id, project_id, organisation_id")
    .in("id", participantIds);

  if (participantError) return fail(participantError.message, 500);
  if ((participants ?? []).length !== participantIds.length) return fail("One or more participants were not found", 404);

  const invalidParticipant = (participants ?? []).find(
    (participant: any) => participant.project_id !== group.project_id || participant.organisation_id !== group.organisation_id
  );

  if (invalidParticipant) {
    return fail("All participants must belong to the same organisation and project as the group", 400);
  }

  const rows = participantIds.map((participantId) => ({
    organisation_id: group.organisation_id,
    project_id: group.project_id,
    group_id: group.id,
    participant_id: participantId,
  }));

  const { data, error } = await supabaseAdmin
    .from("participant_group_memberships")
    .upsert(rows, { onConflict: "group_id,participant_id" })
    .select("*");

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: group.organisation_id,
    project_id: group.project_id,
    actor_type: "dashboard_user",
    action: "participant_group.members_added",
    entity_type: "participant_group",
    entity_id: group.id,
    metadata: { participant_ids: participantIds },
  });

  return ok(data ?? [], 201);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.participant_id) return fail("participant_id is required");

  const { data: group, error: groupError } = await supabaseAdmin
    .from("participant_groups")
    .select("id, organisation_id, project_id")
    .eq("id", groupId)
    .single();

  if (groupError || !group) return fail("Group not found", 404);

  const { error } = await supabaseAdmin
    .from("participant_group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("participant_id", body.participant_id);

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: group.organisation_id,
    project_id: group.project_id,
    actor_type: "dashboard_user",
    action: "participant_group.member_removed",
    entity_type: "participant_group",
    entity_id: groupId,
    metadata: { participant_id: body.participant_id },
  });

  return ok({ removed: true });
}
