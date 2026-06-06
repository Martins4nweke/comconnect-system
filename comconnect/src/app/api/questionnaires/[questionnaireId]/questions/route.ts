import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { requireString } from "@/lib/research-care/validation";
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

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageQuestionnaires(context)) {
      return fail("You do not have permission to add questionnaire questions.", 403);
    }

    const { questionnaireId } = await params;
    const body = await req.json().catch(() => null);

    let questionnaireQuery = supabaseAdmin
      .from("questionnaires")
      .select("id, organisation_id, project_id")
      .eq("id", questionnaireId);

    questionnaireQuery = applyQuestionnaireScope(questionnaireQuery, context);

    const { data: questionnaire, error: qError } =
      await questionnaireQuery.maybeSingle();

    if (qError) return fail(qError.message, 500);

    if (!questionnaire) {
      return fail("Questionnaire not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("questionnaire_questions")
      .insert({
        organisation_id: questionnaire.organisation_id,
        project_id: questionnaire.project_id,
        questionnaire_id: questionnaire.id,
        question_order: body?.question_order ?? 1,
        question_code: requireString(body?.question_code, "question_code"),
        question_text: requireString(body?.question_text, "question_text"),
        question_type: body?.question_type ?? "short_text",
        required: body?.required ?? false,
        options: body?.options ?? [],
        validation: body?.validation ?? {},
        settings: body?.settings ?? {},
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to add question", 400);
  }
}