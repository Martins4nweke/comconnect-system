import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { requireString } from "@/lib/research-care/validation";

type Params = { params: Promise<{ questionnaireId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { questionnaireId } = await params;
  const body = await req.json().catch(() => null);

  const { data: questionnaire, error: qError } = await supabaseAdmin
    .from("questionnaires")
    .select("id, organisation_id, project_id")
    .eq("id", questionnaireId)
    .single();

  if (qError || !questionnaire) return fail("Questionnaire not found", 404);

  try {
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
    return fail(error.message ?? "Failed to add question", 400);
  }
}
