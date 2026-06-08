"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";
import {
  CompactCard,
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "yes_no"
  | "single_choice"
  | "multiple_choice"
  | "date"
  | "rating"
  | "symptom_checklist"
  | "measurement";

type QuestionDraft = {
  question_text: string;
  question_type: QuestionType;
  required: boolean;
  optionsText: string;
};

const questionTypeOptions: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "yes_no", label: "Yes/No" },
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "date", label: "Date" },
  { value: "rating", label: "Rating scale" },
  { value: "symptom_checklist", label: "Symptom checklist" },
  { value: "measurement", label: "Measurement" },
];

const questionnaireTypes = [
  "baseline",
  "follow_up",
  "screening",
  "adherence_checkin",
  "satisfaction_survey",
  "quality_of_life",
  "safety_help",
  "custom_research_survey",
];

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

const primaryButtonClass =
  "rounded-2xl bg-[#0A5278] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#06324A] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-xl border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:text-[#0A5278] disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "w-full rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function emptyQuestion(): QuestionDraft {
  return {
    question_text: "",
    question_type: "short_text",
    required: false,
    optionsText: "",
  };
}

function parseOptions(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label, index) => ({
      label,
      value: label.toLowerCase().replace(/\s+/g, "_") || `option_${index + 1}`,
    }));
}

function parseParticipantCodes(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function labelFromValue(value: string) {
  return value.replace(/_/g, " ");
}

function canManageQuestionnaires(context: CurrentContext | null) {
  const organisationRole = cleanText(context?.organisation_role).toLowerCase();
  const projectRole = cleanText(context?.project_role).toLowerCase();

  return (
    ["superadmin", "organisation_admin", "org_admin", "admin"].includes(
      organisationRole
    ) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

export default function QuestionnairesPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [questionnaireType, setQuestionnaireType] = useState(
    "custom_research_survey"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [creating, setCreating] = useState(false);

  const [questionnaireId, setQuestionnaireId] = useState("");
  const [participantCodesText, setParticipantCodesText] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeProjectId = cleanText(context?.active_project_id);
  const activeProjectCode = cleanText(context?.active_project_code);
  const canManage = canManageQuestionnaires(context);

  const validQuestionCount = useMemo(() => {
    return questions.filter((question) => question.question_text.trim()).length;
  }, [questions]);

  async function loadContext() {
    setLoadingContext(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load context.");
      }

      setContext(json.data as CurrentContext);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      )
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, emptyQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) =>
      current.length === 1
        ? [emptyQuestion()]
        : current.filter((_, questionIndex) => questionIndex !== index)
    );
  }

  function resetQuestionnaireForm() {
    setTitle("");
    setDescription("");
    setStatus("draft");
    setQuestionnaireType("custom_research_survey");
    setQuestions([emptyQuestion()]);
  }

  async function createQuestionnaire() {
    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to create questionnaires.");
      return;
    }

    if (!activeProjectId) {
      setErrorMessage("No active project selected.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Questionnaire title is required.");
      return;
    }

    const validQuestions = questions.filter((question) =>
      question.question_text.trim()
    );

    if (validQuestions.length === 0) {
      setErrorMessage("Add at least one question.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: activeProjectId,
          project_code: activeProjectCode || null,
          title: title.trim(),
          description: description.trim() || null,
          language,
          status,
          version_label: "v1.0",
          questionnaire_type: questionnaireType,
          allow_offline_completion: true,
          allow_partial_save: true,
          questions: validQuestions.map((question, index) => ({
            question_code: `Q${String(index + 1).padStart(3, "0")}`,
            question_text: question.question_text.trim(),
            question_type: question.question_type,
            required: question.required,
            sort_order: index + 1,
            question_order: index + 1,
            options:
              question.question_type === "single_choice" ||
              question.question_type === "multiple_choice" ||
              question.question_type === "symptom_checklist"
                ? parseOptions(question.optionsText)
                : [],
            validation: {},
            scoring: {},
            metadata: {},
          })),
          settings: {
            questionnaire_type: questionnaireType,
          },
          created_from: "questionnaires_page",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create questionnaire.");
      }

      const newQuestionnaireId = json.data?.questionnaire?.id;

      if (newQuestionnaireId) {
        setQuestionnaireId(newQuestionnaireId);
      }

      setNote(
        newQuestionnaireId
          ? `Questionnaire created. ID: ${newQuestionnaireId}`
          : "Questionnaire created."
      );

      resetQuestionnaireForm();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create questionnaire.");
    } finally {
      setCreating(false);
    }
  }

  async function assignQuestionnaire() {
    setNote("");
    setErrorMessage("");

    if (!canManage) {
      setErrorMessage("You do not have permission to assign questionnaires.");
      return;
    }

    if (!questionnaireId.trim()) {
      setErrorMessage("Questionnaire ID is required.");
      return;
    }

    const participantCodes = parseParticipantCodes(participantCodesText);

    if (participantCodes.length === 0) {
      setErrorMessage("Enter at least one participant code.");
      return;
    }

    setAssigning(true);

    try {
      const response = await fetch(
        `/api/questionnaires/${questionnaireId.trim()}/assignments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participant_codes: participantCodes,
            due_at: dueAt ? new Date(dueAt).toISOString() : null,
            status: "active",
            metadata: {
              assigned_from: "questionnaires_page",
              project_id: activeProjectId,
              project_code: activeProjectCode || null,
            },
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to assign questionnaire.");
      }

      const assignedCount = json.data?.assigned_count ?? participantCodes.length;
      const pushResults = Array.isArray(json.data?.push_results)
        ? json.data.push_results
        : [];
      const noTokenCount = pushResults.filter(
        (item: any) => item?.result?.reason === "no_active_push_tokens"
      ).length;

      setNote(
        noTokenCount > 0
          ? `Questionnaire assigned to ${assignedCount} participant(s). ${noTokenCount} had no active push token yet.`
          : `Questionnaire assigned to ${assignedCount} participant(s).`
      );

      setDueAt("");
      setParticipantCodesText("");
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to assign questionnaire.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <PageShell>
      <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
          Research
        </p>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Questionnaires
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
              Create questionnaires, add questions and assign them to
              participants.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={pageLinkClass}>
              Dashboard
            </Link>

            <Link href="/participants" className={pageLinkClass}>
              Participants
            </Link>

            <Link href="/questionnaire-responses" className={pageLinkClass}>
              Questionnaire Responses
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">Role</p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {context?.project_role ?? context?.organisation_role ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Questions
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {validQuestionCount}
          </p>
        </CompactCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <CompactCard
          title="Create questionnaire"
          subtitle="Builder"
          action={
            <div className="flex flex-wrap gap-2">
              <StatusPill>{labelFromValue(questionnaireType)}</StatusPill>
              <StatusPill tone={status === "published" ? "success" : "warning"}>
                {status}
              </StatusPill>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <FieldLabel label="Type">
                <SelectInput
                  value={questionnaireType}
                  onChange={(event) => setQuestionnaireType(event.target.value)}
                >
                  {questionnaireTypes.map((type) => (
                    <option key={type} value={type}>
                      {labelFromValue(type)}
                    </option>
                  ))}
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Language">
                <SelectInput
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="zu">isiZulu</option>
                </SelectInput>
              </FieldLabel>

              <FieldLabel label="Status">
                <SelectInput
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </SelectInput>
              </FieldLabel>
            </div>

            <FieldLabel label="Title">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Questionnaire title"
              />
            </FieldLabel>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description or instruction"
              className={`${textareaClass} min-h-20`}
            />

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-[#06324A]">
                      Question {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <TextInput
                      value={question.question_text}
                      onChange={(event) =>
                        updateQuestion(index, {
                          question_text: event.target.value,
                        })
                      }
                      placeholder="Question text"
                      className="xl:col-span-2"
                    />

                    <SelectInput
                      value={question.question_type}
                      onChange={(event) =>
                        updateQuestion(index, {
                          question_type: event.target.value as QuestionType,
                        })
                      }
                    >
                      {questionTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>

                    <label className="flex items-center gap-2 rounded-xl border border-[#C9D8E4] bg-white px-3 py-2 text-sm font-black text-[#06324A]">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(index, {
                            required: event.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>

                  {(question.question_type === "single_choice" ||
                    question.question_type === "multiple_choice" ||
                    question.question_type === "symptom_checklist") && (
                    <textarea
                      value={question.optionsText}
                      onChange={(event) =>
                        updateQuestion(index, {
                          optionsText: event.target.value,
                        })
                      }
                      placeholder="Options, one per line"
                      className={`${textareaClass} mt-3 min-h-20`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addQuestion}
                className={secondaryButtonClass}
              >
                Add question
              </button>

              <button
                type="button"
                onClick={createQuestionnaire}
                disabled={creating || !canManage || !activeProjectId}
                className={primaryButtonClass}
              >
                {creating ? "Creating..." : "Create questionnaire"}
              </button>
            </div>

            {!canManage ? (
              <p className="text-xs font-bold text-[#536271]">
                Your role can view questionnaires but cannot create or assign.
              </p>
            ) : null}
          </div>
        </CompactCard>

        <CompactCard title="Bulk assign" subtitle="Participant codes">
          <div className="space-y-3">
            <FieldLabel label="Questionnaire ID">
              <TextInput
                value={questionnaireId}
                onChange={(event) => setQuestionnaireId(event.target.value)}
                placeholder="Paste questionnaire ID"
              />
            </FieldLabel>

            <FieldLabel label="Due date/time">
              <TextInput
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </FieldLabel>

            <textarea
              value={participantCodesText}
              onChange={(event) => setParticipantCodesText(event.target.value)}
              placeholder={
                "Participant codes, one per line\nDEMO-P001\nDEMO-P002"
              }
              className={`${textareaClass} min-h-40`}
            />

            <button
              type="button"
              onClick={assignQuestionnaire}
              disabled={assigning || !canManage}
              className={primaryButtonClass}
            >
              {assigning ? "Assigning..." : "Bulk assign"}
            </button>
          </div>
        </CompactCard>
      </div>

      <div className="mt-4">
        <LargeTableClient config={tableConfigs.questionnaires} />
      </div>
    </PageShell>
  );
}