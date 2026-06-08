import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 1) return fallback;

  return Math.floor(parsed);
}

function clampLimit(value: string | null) {
  const parsed = parsePositiveInt(value, DEFAULT_LIMIT);

  return Math.min(parsed, MAX_LIMIT);
}

function participantLabel(participant: any) {
  if (!participant) return "";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.display_name ||
    fullName ||
    participant.participant_code ||
    participant.phone_number ||
    ""
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const projectId = cleanText(searchParams.get("project_id"));
    const status = cleanText(searchParams.get("status"));
    const q = cleanText(searchParams.get("q"));
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = clampLimit(searchParams.get("limit"));

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "project_id is required." },
        { status: 400 }
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let participantIds: string[] = [];
    let questionnaireIds: string[] = [];

    if (q) {
      const like = `%${q}%`;

      const { data: participants, error: participantSearchError } =
        await supabaseAdmin
          .from("participants")
          .select("id")
          .eq("project_id", projectId)
          .or(
            `participant_code.ilike.${like},phone_number.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},display_name.ilike.${like}`
          )
          .limit(1000);

      if (participantSearchError) {
        throw participantSearchError;
      }

      participantIds = (participants ?? []).map((participant) => participant.id);

      const { data: questionnaires, error: questionnaireSearchError } =
        await supabaseAdmin
          .from("questionnaires")
          .select("id")
          .eq("project_id", projectId)
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(1000);

      if (questionnaireSearchError) {
        throw questionnaireSearchError;
      }

      questionnaireIds = (questionnaires ?? []).map(
        (questionnaire) => questionnaire.id
      );
    }

    let query = supabaseAdmin
      .from("questionnaire_responses")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("submitted_at", { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq("status", status);
    }

    if (q) {
      const orParts: string[] = [];

      orParts.push(`local_id.ilike.%${q}%`);

      if (participantIds.length > 0) {
        orParts.push(`participant_id.in.(${participantIds.join(",")})`);
      }

      if (questionnaireIds.length > 0) {
        orParts.push(`questionnaire_id.in.(${questionnaireIds.join(",")})`);
      }

      query = query.or(orParts.join(","));
    }

    const { data: responses, error: responseError, count } = await query;

    if (responseError) {
      throw responseError;
    }

    const rows = Array.isArray(responses) ? responses : [];

    const pageParticipantIds = Array.from(
      new Set(rows.map((row) => cleanText(row.participant_id)).filter(Boolean))
    );

    const pageQuestionnaireIds = Array.from(
      new Set(rows.map((row) => cleanText(row.questionnaire_id)).filter(Boolean))
    );

    let participantsById: Record<string, any> = {};
    let questionnairesById: Record<string, any> = {};

    if (pageParticipantIds.length > 0) {
      const { data: participants, error: participantError } =
        await supabaseAdmin
          .from("participants")
          .select(
            "id, participant_code, phone_number, first_name, last_name, display_name, preferred_language, status"
          )
          .in("id", pageParticipantIds);

      if (participantError) {
        throw participantError;
      }

      participantsById = Object.fromEntries(
        (participants ?? []).map((participant) => [participant.id, participant])
      );
    }

    if (pageQuestionnaireIds.length > 0) {
      const { data: questionnaires, error: questionnaireError } =
        await supabaseAdmin
          .from("questionnaires")
          .select("id, title, description, language, status, version_label, settings")
          .in("id", pageQuestionnaireIds);

      if (questionnaireError) {
        throw questionnaireError;
      }

      questionnairesById = Object.fromEntries(
        (questionnaires ?? []).map((questionnaire) => [
          questionnaire.id,
          questionnaire,
        ])
      );
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      participant: participantsById[row.participant_id] ?? null,
      participant_label: participantLabel(participantsById[row.participant_id]),
      questionnaire: questionnairesById[row.questionnaire_id] ?? null,
    }));

    const total = count ?? enrichedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      data: enrichedRows,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_previous: page > 1,
        has_next: page < totalPages,
        from,
        to,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Failed to load questionnaire responses.",
      },
      { status: 500 }
    );
  }
}