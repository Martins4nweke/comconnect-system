"use client";

import { useState } from "react";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { tableConfigs } from "@/components/comconnect-actions/tableConfigs";

type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "yes_no"
  | "single_choice"
  | "multiple_choice"
  | "date"
  | "time"
  | "datetime"
  | "rating"
  | "likert"
  | "bp_reading"
  | "medication_adherence"
  | "consent_confirmation";

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
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date and time" },
  { value: "rating", label: "Rating scale" },
  { value: "likert", label: "Likert scale" },
  { value: "bp_reading", label: "BP reading" },
  { value: "medication_adherence", label: "Medication adherence" },
  { value: "consent_confirmation", label: "Consent confirmation" },
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

export default function Page() {
  const [projectCode, setProjectCode] = useState("DEMO-001");
  const [questionnaireType, setQuestionnaireType] = useState("custom_research_survey");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const [questionnaireId, setQuestionnaireId] = useState("");
  const [participantCodesText, setParticipantCodesText] = useState("DEMO-P001");
  const [dueAt, setDueAt] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");

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

  async function createQuestionnaire() {
    setCreateMessage("");

    if (!projectCode.trim()) {
      setCreateMessage("Project code is required.");
      return;
    }

    if (!title.trim()) {
      setCreateMessage("Questionnaire title is required.");
      return;
    }

    const validQuestions = questions.filter((question) =>
      question.question_text.trim()
    );

    if (validQuestions.length === 0) {
      setCreateMessage("Add at least one question.");
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
          project_code: projectCode.trim(),
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
            options:
              question.question_type === "single_choice" ||
              question.question_type === "multiple_choice" ||
              question.question_type === "likert"
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

      setCreateMessage(
        newQuestionnaireId
          ? `Questionnaire created successfully. ID: ${newQuestionnaireId}`
          : "Questionnaire created successfully."
      );

      if (newQuestionnaireId) {
        setQuestionnaireId(newQuestionnaireId);
      }

      setTitle("");
      setDescription("");
      setStatus("draft");
      setQuestionnaireType("custom_research_survey");
      setQuestions([emptyQuestion()]);

      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error: any) {
      setCreateMessage(error?.message ?? "Failed to create questionnaire.");
    } finally {
      setCreating(false);
    }
  }

  async function assignQuestionnaire() {
    setAssignMessage("");

    if (!questionnaireId.trim()) {
      setAssignMessage("Questionnaire ID is required.");
      return;
    }

    const participantCodes = parseParticipantCodes(participantCodesText);

    if (participantCodes.length === 0) {
      setAssignMessage("Enter at least one participant code.");
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
              project_code: projectCode.trim(),
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

      if (noTokenCount > 0) {
        setAssignMessage(
          `Questionnaire assigned to ${assignedCount} participant(s). ${noTokenCount} had no active push token yet.`
        );
      } else {
        setAssignMessage(
          `Questionnaire assigned to ${assignedCount} participant(s).`
        );
      }

      setDueAt("");

      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error: any) {
      setAssignMessage(error?.message ?? "Failed to assign questionnaire.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171717]">
        <div className="mb-4">
          <p className="text-sm font-black uppercase tracking-wide text-[#F26A21]">
            Questionnaire builder
          </p>
          <h2 className="text-xl font-black text-slate-950">
            Create questionnaire
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Create baseline, follow-up, screening, adherence, satisfaction, quality-of-life, safety, or custom research questionnaires.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
            placeholder="Project code, e.g. DEMO-001"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <select
            value={questionnaireType}
            onChange={(event) => setQuestionnaireType(event.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            {questionnaireTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="en">English</option>
            <option value="zu">isiZulu</option>
          </select>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Questionnaire title"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description or instruction"
          className="mt-3 min-h-20 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        <div className="mt-4 space-y-3">
          {questions.map((question, index) => (
            <div
              key={index}
              className="rounded-3xl border-2 border-slate-200 bg-[#FFF7F2] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-950">
                  Question {index + 1}
                </h3>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="rounded-xl border border-red-300 bg-white px-3 py-1 text-xs font-black text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  value={question.question_text}
                  onChange={(event) =>
                    updateQuestion(index, {
                      question_text: event.target.value,
                    })
                  }
                  placeholder="Question text"
                  className="xl:col-span-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <select
                  value={question.question_type}
                  onChange={(event) =>
                    updateQuestion(index, {
                      question_type: event.target.value as QuestionType,
                    })
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                >
                  {questionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
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
                question.question_type === "likert") && (
                <textarea
                  value={question.optionsText}
                  onChange={(event) =>
                    updateQuestion(index, {
                      optionsText: event.target.value,
                    })
                  }
                  placeholder="Options, one per line"
                  className="mt-3 min-h-20 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717]"
          >
            Add question
          </button>

          <button
            type="button"
            onClick={createQuestionnaire}
            disabled={creating}
            className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create questionnaire"}
          </button>
        </div>

        {createMessage ? (
          <p className="mt-3 text-sm font-black text-slate-700">
            {createMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-[28px] border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171717]">
        <div className="mb-4">
          <p className="text-sm font-black uppercase tracking-wide text-[#F26A21]">
            Questionnaire action
          </p>
          <h2 className="text-xl font-black text-slate-950">
            Bulk assign questionnaire
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Enter participant codes one per line. ComConnect will assign the questionnaire to all listed participants.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={questionnaireId}
            onChange={(event) => setQuestionnaireId(event.target.value)}
            placeholder="Questionnaire ID"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
          />

          <div className="flex flex-col gap-1">
            <label className="px-1 text-xs font-black uppercase text-slate-500">
              Due date/time optional
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
            />
          </div>

          <button
            type="button"
            onClick={assignQuestionnaire}
            disabled={assigning}
            className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
          >
            {assigning ? "Assigning..." : "Bulk assign"}
          </button>
        </div>

        <textarea
          value={participantCodesText}
          onChange={(event) => setParticipantCodesText(event.target.value)}
          placeholder={"Participant codes, one per line\nDEMO-P001\nDEMO-P002"}
          className="mt-3 min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
        />

        {assignMessage ? (
          <p className="mt-3 text-sm font-black text-slate-700">
            {assignMessage}
          </p>
        ) : null}
      </section>

      <LargeTableClient config={tableConfigs.questionnaires} />
    </div>
  );
}