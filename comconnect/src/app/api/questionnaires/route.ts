import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getProjectOrganisation,
  ensureModuleEnabled,
} from "@/lib/research-care/module-access";
import { requireString } from "@/lib/research-care/validation";

type QuestionInput = {
  question_code?: string;
  question_text?: string;
  question_type?: string;
  required?: boolean;
  sort_order?: number;
  options?: unknown;
  validation?: unknown;
  scoring?: unknown;
  metadata?: Record<string, unknown>;
};

const ALLOWED_QUESTION_TYPES = new Set([
  "short_text",
  "long_text",
  "number",
  "yes_no",
  "single_choice",
  "multiple_choice",
  "date",
  "time",
  "datetime",
  "rating",
  "likert",
  "bp_reading",
  "medication_adherence",
  "consent_confirmation",
]);

function normaliseQuestionType(value: unknown) {
  const type = String(value ?? "short_text").trim();

  if (ALLOWED_QUESTION_TYPES.has(type)) {
    return type;
  }

  return "short_text";
}

function buildQuestionCode(index: number) {
  return `Q${String(index + 1).padStart(3, "0")}`;
}

async function resolveProject(body: any) {
  const projectId = body?.project_id ? String(body.project_id).trim() : null;
  const projectCode = body?.project_code
    ? String(body.project_code).trim()
    : null;

  if (projectId) {
    return getProjectOrganisation(projectId);
  }

  if (projectCode) {
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id, organisation_id, project_code, status, app_access_enabled")
      .eq("project_code", projectCode)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!project) {
      throw new Error("Project code not found.");
    }

    return {
      id: project.id,
      organisation_id: project.organisation_id,
    };
  }

  throw new Error("project_id or project_code is required.");
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const projectCode = req.nextUrl.searchParams.get("project_code");

  let resolvedProjectId = projectId;

  if (!resolvedProjectId && projectCode) {
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("project_code", projectCode)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!project) return fail("Project code not found", 404);

    resolvedProjectId = project.id;
  }

  if (!resolvedProjectId) {
    return fail("project_id or project_code is required");
  }

  const { data, error } = await supabaseAdmin
    .from("questionnaires")
    .select("*, questionnaire_questions(*)")
    .eq("project_id", resolvedProjectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const project = await resolveProject(body);

    await ensureModuleEnabled(project.id, "questionnaires");

    const questionnaireType = body?.questionnaire_type ?? body?.type ?? "custom";

    const { data: questionnaire, error } = await supabaseAdmin
      .from("questionnaires")
      .insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        title: requireString(body.title, "title"),
        description: body.description ?? null,
        language: body.language ?? "en",
        status: body.status ?? "draft",
        version_label: body.version_label ?? "v1.0",
        settings: {
          ...(body.settings ?? {}),
          questionnaire_type: questionnaireType,
          allow_offline_completion: body.allow_offline_completion ?? true,
          allow_partial_save: body.allow_partial_save ?? true,
          created_from: body.created_from ?? "questionnaires_api",
          project_code: body.project_code ?? null,
        },
        published_at:
          body.status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    const questions = Array.isArray(body.questions)
      ? (body.questions as QuestionInput[])
      : [];

    let insertedQuestions: unknown[] = [];

    if (questions.length > 0) {
      const questionRows = questions.map((question, index) => ({
  organisation_id: project.organisation_id,
  project_id: project.id,
  questionnaire_id: questionnaire.id,
  question_code:
    question.question_code?.trim() || buildQuestionCode(index),
  question_text: requireString(
    question.question_text,
    `questions[${index}].question_text`
  ),
  question_type: normaliseQuestionType(question.question_type),
  required:
    typeof question.required === "boolean" ? question.required : false,
  sort_order:
    typeof question.sort_order === "number"
      ? question.sort_order
      : index + 1,
  options: question.options ?? [],
  validation: question.validation ?? {},
  scoring: question.scoring ?? {},
}));

      const { data: createdQuestions, error: questionError } =
        await supabaseAdmin
          .from("questionnaire_questions")
          .insert(questionRows)
          .select("*");

      if (questionError) {
        return fail(questionError.message, 500);
      }

      insertedQuestions = createdQuestions ?? [];
    }

    await createAuditLog({
      organisation_id: project.organisation_id,
      project_id: project.id,
      actor_type: "dashboard_user",
      action: "questionnaire.created",
      entity_type: "questionnaire",
      entity_id: questionnaire.id,
      metadata: {
        title: questionnaire.title,
        questionnaire_type: questionnaireType,
        question_count: questions.length,
        project_code: body.project_code ?? null,
      },
    });

    return ok(
      {
        questionnaire,
        questions: insertedQuestions,
      },
      201
    );
  } catch (error: any) {
    return fail(error.message ?? "Failed to create questionnaire", 400);
  }
}