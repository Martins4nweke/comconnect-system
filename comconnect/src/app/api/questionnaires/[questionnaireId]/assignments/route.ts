import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { validateAssignmentTarget } from "@/lib/research-care/assignment";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ questionnaireId: string }> };

type ParticipantTarget = {
  id: string;
  organisation_id: string;
  project_id: string;
  participant_code?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

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

function canManageQuestionnaires(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

function applyQuestionnaireScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

async function resolveParticipants({
  organisationId,
  projectId,
  body,
}: {
  organisationId: string;
  projectId: string;
  body: any;
}): Promise<ParticipantTarget[]> {
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
      .eq("organisation_id", organisationId)
      .eq("project_id", projectId)
      .in("id", uniqueParticipantIds);

    if (error) throw new Error(error.message);

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
      .eq("organisation_id", organisationId)
      .eq("project_id", projectId)
      .in("participant_code", uniqueParticipantCodes);

    if (error) throw new Error(error.message);

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

async function sendQuestionnairePush({
  questionnaire,
  assignment,
}: {
  questionnaire: any;
  assignment: any;
}) {
  const titleText = String(questionnaire.title ?? "New questionnaire");

  return sendParticipantPushNotification({
    organisation_id: questionnaire.organisation_id,
    project_id: questionnaire.project_id,
    participant_id: assignment.participant_id,
    title: "New questionnaire",
    body: titleText.length > 90 ? `${titleText.slice(0, 90)}...` : titleText,
    data: {
      type: "questionnaire",
      screen: "questionnaires",
      questionnaire_id: questionnaire.id,
      assignment_id: assignment.id,
      due_at: assignment.due_at,
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageQuestionnaires(context)) {
      return fail("You do not have permission to assign questionnaires.", 403);
    }

    const { questionnaireId } = await params;
    const body = await req.json().catch(() => null);

    let questionnaireQuery = supabaseAdmin
      .from("questionnaires")
      .select("id, organisation_id, project_id, title, description")
      .eq("id", questionnaireId);

    questionnaireQuery = applyQuestionnaireScope(questionnaireQuery, context);

    const { data: questionnaire, error: qError } =
      await questionnaireQuery.maybeSingle();

    if (qError) return fail(qError.message, 500);

    if (!questionnaire) {
      return fail("Questionnaire not found or not allowed.", 404);
    }

    const participants = await resolveParticipants({
      organisationId: questionnaire.organisation_id,
      projectId: questionnaire.project_id,
      body,
    });

    /*
      Group assignment is kept for later.
      For now, bulk assignment is done by participant_ids or participant_codes.
    */
    if (participants.length === 0 && body?.group_id) {
      await validateAssignmentTarget(questionnaire.project_id, {
        participant_id: null,
        group_id: body.group_id,
      });

      const { data, error } = await supabaseAdmin
        .from("questionnaire_assignments")
        .insert({
          organisation_id: questionnaire.organisation_id,
          project_id: questionnaire.project_id,
          questionnaire_id: questionnaire.id,
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

      if (error) return fail(error.message, 500);

      const pushResult = {
        sent: 0,
        skipped: true,
        reason: "group_assignment_push_not_enabled_yet",
      };

      await createAuditLog({
        organisation_id: questionnaire.organisation_id,
        project_id: questionnaire.project_id,
        actor_type: "dashboard_user",
        action: "questionnaire.assigned",
        entity_type: "questionnaire",
        entity_id: questionnaire.id,
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
      organisation_id: questionnaire.organisation_id,
      project_id: questionnaire.project_id,
      questionnaire_id: questionnaire.id,
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
      .from("questionnaire_assignments")
      .insert(assignmentRows)
      .select("*");

    if (error) return fail(error.message, 500);

    const createdAssignments = assignments ?? [];
    const pushResults = [];

    for (const assignment of createdAssignments) {
      try {
        const result = await sendQuestionnairePush({
          questionnaire,
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
      organisation_id: questionnaire.organisation_id,
      project_id: questionnaire.project_id,
      actor_type: "dashboard_user",
      action:
        createdAssignments.length > 1
          ? "questionnaire.bulk_assigned"
          : "questionnaire.assigned",
      entity_type: "questionnaire",
      entity_id: questionnaire.id,
      metadata: {
        assignment_count: createdAssignments.length,
        participant_ids: createdAssignments.map((item) => item.participant_id),
        assignment_ids: createdAssignments.map((item) => item.id),
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
    return fail(error?.message ?? "Failed to assign questionnaire", 400);
  }
}