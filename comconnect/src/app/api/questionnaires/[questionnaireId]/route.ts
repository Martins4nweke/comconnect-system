import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ questionnaireId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { questionnaireId } = await params;

  const { data, error } = await supabaseAdmin
    .from("questionnaires")
    .select("*, questionnaire_questions(*), questionnaire_assignments(*)")
    .eq("id", questionnaireId)
    .single();

  if (error) return fail("Questionnaire not found", 404);
  return ok(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { questionnaireId } = await params;
  const body = await req.json().catch(() => null);

  const { data, error } = await supabaseAdmin
    .from("questionnaires")
    .update({
      title: body?.title,
      description: body?.description,
      language: body?.language,
      status: body?.status,
      version_label: body?.version_label,
      settings: body?.settings,
      published_at: body?.status === "published" ? new Date().toISOString() : body?.published_at,
    })
    .eq("id", questionnaireId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

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
}
