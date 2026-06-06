import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ questionnaireId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { questionnaireId } = await params;

    let query = supabaseAdmin
      .from("questionnaires")
      .select("*, questionnaire_questions(*), questionnaire_assignments(*)")
      .eq("id", questionnaireId);

    query = applyQuestionnaireScope(query, context);

    const { data, error } = await query.maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Questionnaire not found or not allowed.", 404);

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load questionnaire", 500);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageQuestionnaires(context)) {
      return fail("You do not have permission to update questionnaires.", 403);
    }

    const { questionnaireId } = await params;
    const body = await req.json().catch(() => null);

    let query = supabaseAdmin
      .from("questionnaires")
      .update({
        title: body?.title,
        description: body?.description,
        language: body?.language,
        status: body?.status,
        version_label: body?.version_label,
        settings: body?.settings,
        published_at:
          body?.status === "published"
            ? new Date().toISOString()
            : body?.published_at,
      })
      .eq("id", questionnaireId);

    query = applyQuestionnaireScope(query, context);

    const { data, error } = await query.select("*").maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Questionnaire not found or not allowed.", 404);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "questionnaire.updated",
      entity_type: "questionnaire",
      entity_id: data.id,
      metadata: { title: data.title },
    });

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update questionnaire", 500);
  }
}