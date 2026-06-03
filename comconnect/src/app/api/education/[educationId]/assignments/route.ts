import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { validateAssignmentTarget } from "@/lib/research-care/assignment";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";

type Params = { params: Promise<{ educationId: string }> };

type ParticipantTarget = {
  id: string;
  organisation_id: string;
  project_id: string;
  participant_code?: string | null;
};

function cleanList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function resolveParticipants(
  projectId: string,
  body: any
): Promise<ParticipantTarget[]> {
  const participantIds = cleanList(body?.participant_ids);
  const participantCodes = cleanList(body?.participant_codes);

  if (body?.participant_id) {
    participantIds.push(String(body.participant_id).trim());
  }

  if (body?.participant_code) {
    participantCodes.push(String(body.participant_code).trim());
  }

  const uniqueParticipantIds = Array.from(new Set(participantIds));
  const uniqueParticipantCodes = Array.from(new Set(participantCodes));

  if (uniqueParticipantIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, organisation_id, project_id, participant_code")
      .eq("project_id", projectId)
      .in("id", uniqueParticipantIds);

    if (error) {
      throw new Error(error.message);
    }

    const found = data ?? [];

    if (found.length !== uniqueParticipantIds.length) {
      throw new Error(
        "One or more participant IDs were not found for this project."
      );
    }

    return found;
  }

  if (uniqueParticipantCodes.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, organisation_id, project_id, participant_code")
      .eq("project_id", projectId)
      .in("participant_code", uniqueParticipantCodes);

    if (error) {
      throw new Error(error.message);
    }

    const found = data ?? [];
    const foundCodes = new Set(found.map((item) => item.participant_code));

    const missingCodes = uniqueParticipantCodes.filter(
      (code) => !foundCodes.has(code)
    );

    if (missingCodes.length > 0) {
      throw new Error(
        `Participant code(s) not found for this project: ${missingCodes.join(
          ", "
        )}`
      );
    }

    return found;
  }

  return [];
}

async function sendEducationPush({
  item,
  assignment,
}: {
  item: any;
  assignment: any;
}) {
  const titleText = String(item.title ?? "New education content");

  return sendParticipantPushNotification({
    organisation_id: item.organisation_id,
    project_id: item.project_id,
    participant_id: assignment.participant_id,
    title: "New education content",
    body:
      titleText.length > 90 ? `${titleText.slice(0, 90)}...` : titleText,
    data: {
      type: "education",
      screen: "education",
      education_item_id: item.id,
      assignment_id: assignment.id,
      due_at: assignment.due_at,
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { educationId } = await params;
  const body = await req.json().catch(() => null);

  const { data: item, error: itemError } = await supabaseAdmin
    .from("education_items")
    .select("id, organisation_id, project_id, title, description")
    .eq("id", educationId)
    .single();

  if (itemError || !item) {
    return fail("Education item not found", 404);
  }

  try {
    const participants = await resolveParticipants(item.project_id, body);

    /*
      Group assignment is kept for later.
      For now, bulk assignment is by participant_ids or participant_codes.
    */
    if (participants.length === 0 && body?.group_id) {
      await validateAssignmentTarget(item.project_id, {
        participant_id: null,
        group_id: body.group_id,
      });

      const { data, error } = await supabaseAdmin
        .from("education_assignments")
        .insert({
          organisation_id: item.organisation_id,
          project_id: item.project_id,
          education_item_id: item.id,
          participant_id: null,
          group_id: body.group_id,
          due_at: body?.due_at ?? null,
          status: body?.status ?? "active",
          metadata: {
            ...(body?.metadata ?? {}),
            assignment_mode: "group",
          },
        })
        .select("*")
        .single();

      if (error) {
        return fail(error.message, 500);
      }

      const pushResult = {
        sent: 0,
        skipped: true,
        reason: "group_assignment_push_not_enabled_yet",
      };

      await createAuditLog({
        organisation_id: item.organisation_id,
        project_id: item.project_id,
        actor_type: "dashboard_user",
        action: "education_item.assigned",
        entity_type: "education_item",
        entity_id: item.id,
        metadata: {
          assignment_id: data.id,
          group_id: data.group_id,
          assignment_mode: "group",
          push_result: pushResult,
        },
      });

      return ok(
        {
          assignment: data,
          assignments: [data],
          assigned_count: 1,
          push_result: pushResult,
          push_results: [pushResult],
        },
        201
      );
    }

    if (participants.length === 0) {
      return fail(
        "participant_id, participant_ids, participant_code, participant_codes, or group_id is required",
        400
      );
    }

    const assignmentRows = participants.map((participant) => ({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      education_item_id: item.id,
      participant_id: participant.id,
      group_id: null,
      due_at: body?.due_at ?? null,
      status: body?.status ?? "active",
      metadata: {
        ...(body?.metadata ?? {}),
        assignment_mode: participants.length > 1 ? "bulk" : "single",
        participant_code: participant.participant_code ?? null,
      },
    }));

    const { data: assignments, error } = await supabaseAdmin
      .from("education_assignments")
      .insert(assignmentRows)
      .select("*");

    if (error) {
      return fail(error.message, 500);
    }

    const createdAssignments = assignments ?? [];
    const pushResults = [];

    for (const assignment of createdAssignments) {
      try {
        const result = await sendEducationPush({
          item,
          assignment,
        });

        pushResults.push({
          assignment_id: assignment.id,
          participant_id: assignment.participant_id,
          result,
        });
      } catch (pushError: any) {
        pushResults.push({
          assignment_id: assignment.id,
          participant_id: assignment.participant_id,
          result: {
            sent: 0,
            skipped: true,
            reason: pushError?.message ?? "push_failed",
          },
        });
      }
    }

    await createAuditLog({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      actor_type: "dashboard_user",
      action:
        createdAssignments.length > 1
          ? "education_item.bulk_assigned"
          : "education_item.assigned",
      entity_type: "education_item",
      entity_id: item.id,
      metadata: {
        assignment_count: createdAssignments.length,
        participant_ids: createdAssignments.map((row) => row.participant_id),
        assignment_ids: createdAssignments.map((row) => row.id),
        push_results: pushResults,
      },
    });

    return ok(
      {
        assignment: createdAssignments[0] ?? null,
        assignments: createdAssignments,
        assigned_count: createdAssignments.length,
        push_result: pushResults[0]?.result ?? null,
        push_results: pushResults,
      },
      201
    );
  } catch (error: any) {
    return fail(error.message ?? "Failed to assign education item", 400);
  }
}