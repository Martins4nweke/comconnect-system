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
  question_order?: number;
  options?: unknown;
  validation?: unknown;
  scoring?: unknown;
  settings?: unknown;
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
  "rating",
  "symptom_checklist",
  "measurement",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseQuestionType(value: unknown) {
  const raw = cleanText(value).toLowerCase();

  /*
    The database has a strict check constraint.
    These aliases allow the dashboard/app to send friendlier names
    while the API stores the database-approved values.
  */
  const aliases: Record<string, string> = {
    text: "short_text",
    short_text: "short_text",
    short: "short_text",

    textarea: "long_text",
    long_text: "long_text",
    long: "long_text",

    numeric: "number",
    number: "number",

    yesno: "yes_no",
    yes_no: "yes_no",

    radio: "single_choice",
    select: "single_choice",
    single_choice: "single_choice",

    checkbox: "multiple_choice",
    multiple_choice: "multiple_choice",

    date: "date",
    rating: "rating",
    symptom_checklist: "symptom_checklist",
    measurement: "measurement",
  };

  const normalised = aliases[raw] ?? "short_text";

  if (ALLOWED_QUESTION_TYPES.has(normalised)) {
    return normalised;
  }

  return "short_text";
}

function toAppQuestionType(questionType: string) {
  if (questionType === "short_text") return "text";
  if (questionType === "long_text") return "textarea";
  if (questionType === "single_choice") return "radio";
  if (questionType === "multiple_choice") return "checkbox";
  if (questionType === "symptom_checklist") return "checkbox";
  if (questionType === "measurement") return "number";

  return questionType;
}

function buildQuestionCode(index: number) {
  return `Q${String(index + 1).padStart(3, "0")}`;
}

function toJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  return [];
}

function toJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getSortOrder(question: QuestionInput, index: number) {
  if (typeof question.sort_order === "number") return question.sort_order;
  if (typeof question.question_order === "number") return question.question_order;
  return index + 1;
}

function buildFormSchemaFromQuestions(questions: any[]) {
  return {
    fields: questions.map((question, index) => {
      const validation = toJsonObject(question.validation);
      const questionType = cleanText(question.question_type) || "short_text";

      return {
        key: cleanText(question.question_code) || buildQuestionCode(index),
        label: cleanText(question.question_text) || `Question ${index + 1}`,
        type: toAppQuestionType(questionType),
        required: Boolean(question.required),
        options: Array.isArray(question.options) ? question.options : [],
        min:
          typeof validation.min === "number"
            ? validation.min
            : undefined,
        max:
          typeof validation.max === "number"
            ? validation.max
            : undefined,
        placeholder:
          typeof validation.placeholder === "string"
            ? validation.placeholder
            : undefined,
      };
    }),
  };
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

    const questions = Array.isArray(body?.questions)
      ? (body.questions as QuestionInput[])
      : [];

    const { data: questionnaire, error } = await supabaseAdmin
      .from("questionnaires")
      .insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        title: requireString(body?.title, "title"),
        description: body?.description ?? null,
        language: body?.language ?? "en",
        status: body?.status ?? "draft",
        version_label: body?.version_label ?? "v1.0",
        form_schema: { fields: [] },
        settings: {
          ...(body?.settings ?? {}),
          questionnaire_type: questionnaireType,
          allow_offline_completion: body?.allow_offline_completion ?? true,
          allow_partial_save: body?.allow_partial_save ?? true,
          created_from: body?.created_from ?? "questionnaires_api",
          project_code: body?.project_code ?? null,
        },
        published_at:
          body?.status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    let insertedQuestions: any[] = [];

    if (questions.length > 0) {
      const questionRows = questions.map((question, index) => {
        const questionType = normaliseQuestionType(question.question_type);
        const sortOrder = getSortOrder(question, index);
        const questionCode =
          cleanText(question.question_code) || buildQuestionCode(index);

        return {
          organisation_id: project.organisation_id,
          project_id: project.id,
          questionnaire_id: questionnaire.id,
          question_order: sortOrder,
          sort_order: sortOrder,
          question_code: questionCode,
          question_text: requireString(
            question.question_text,
            `questions[${index}].question_text`
          ),
          question_type: questionType,
          required:
            typeof question.required === "boolean" ? question.required : false,
          options: toJsonArray(question.options),
          validation: toJsonObject(question.validation),
          scoring: toJsonObject(question.scoring),
          settings: toJsonObject(question.settings ?? question.metadata),
        };
      });

      const { data: createdQuestions, error: questionError } =
        await supabaseAdmin
          .from("questionnaire_questions")
          .insert(questionRows)
          .select("*");

      if (questionError) {
        return fail(questionError.message, 500);
      }

      insertedQuestions = createdQuestions ?? [];

      const formSchema = buildFormSchemaFromQuestions(insertedQuestions);

      const { error: schemaError } = await supabaseAdmin
        .from("questionnaires")
        .update({
          form_schema: formSchema,
        })
        .eq("id", questionnaire.id);

      if (schemaError) {
        return fail(schemaError.message, 500);
      }

      questionnaire.form_schema = formSchema;
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
        question_count: insertedQuestions.length,
        project_code: body?.project_code ?? null,
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