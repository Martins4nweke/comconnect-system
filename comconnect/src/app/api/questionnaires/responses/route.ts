import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const projectId = cleanText(url.searchParams.get("project_id"));
  const questionnaireId = cleanText(url.searchParams.get("questionnaire_id"));
  const participantId = cleanText(url.searchParams.get("participant_id"));
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  if (!projectId) {
    return fail("project_id is required", 400);
  }

  try {
    let query = supabaseAdmin
      .from("questionnaire_responses")
      .select(
        `
        id,
        organisation_id,
        project_id,
        participant_id,
        questionnaire_id,
        local_id,
        answers,
        status,
        score,
        created_offline_at,
        submitted_at,
        synced_at,
        metadata,
        created_at,
        participants (
          id,
          participant_code,
          first_name,
          last_name,
          phone_number,
          metadata
        ),
        questionnaires (
          id,
          title,
          questionnaire_type,
          language,
          status
        )
      `
      )
      .eq("project_id", projectId)
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (questionnaireId) {
      query = query.eq("questionnaire_id", questionnaireId);
    }

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message, 500);
    }

    return ok({
      responses: data ?? [],
      count: data?.length ?? 0,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load questionnaire responses.", 500);
  }
}