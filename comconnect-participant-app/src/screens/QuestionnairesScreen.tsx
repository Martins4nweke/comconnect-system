import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { apiFetch } from "../api/client";
import { saveSyncCache } from "../storage/localStore";

type StatusType = "success" | "offline" | "error" | "info";

type QuestionField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: string[];
  scale?: string[];
};

function pickQuestionnaires(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.questionnaireAssignments)
    ? app.questionnaireAssignments
    : [];

  const fromCacheQuestionnaires = Array.isArray(cache?.questionnaires)
    ? cache.questionnaires
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.questionnaire_assignments
  )
    ? cache.research_care.questionnaire_assignments
    : [];

  const fromDataQuestionnaires = Array.isArray(cache?.data?.questionnaires)
    ? cache.data.questionnaires
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.questionnaire_assignments
  )
    ? cache.data.research_care.questionnaire_assignments
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheQuestionnaires.length > 0) return fromCacheQuestionnaires;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataQuestionnaires.length > 0) return fromDataQuestionnaires;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function getQuestionnaire(item: any) {
  return item.questionnaires ?? item;
}

function getQuestionnaireId(item: any) {
  const questionnaire = getQuestionnaire(item);

  return (
    item.questionnaire_id ??
    questionnaire.id ??
    item.id
  );
}

function getFields(questionnaire: any): QuestionField[] {
  const fields = questionnaire?.form_schema?.fields;

  if (Array.isArray(fields) && fields.length > 0) {
    return fields;
  }

  return [];
}

function validateAnswers(fields: QuestionField[], answers: Record<string, any>) {
  for (const field of fields) {
    const value = answers[field.key];

    if (
      field.required &&
      (value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0))
    ) {
      return `Please answer: ${field.label}`;
    }

    if (field.type === "number" && value !== undefined && value !== "") {
      const numberValue = Number(value);

      if (!Number.isFinite(numberValue)) {
        return `${field.label} must be a number.`;
      }

      if (typeof field.min === "number" && numberValue < field.min) {
        return `${field.label} must be at least ${field.min}.`;
      }

      if (typeof field.max === "number" && numberValue > field.max) {
        return `${field.label} must not be more than ${field.max}.`;
      }
    }
  }

  return null;
}

function normaliseAnswers(fields: QuestionField[], answers: Record<string, any>) {
  const output: Record<string, any> = {};

  fields.forEach((field) => {
    const value = answers[field.key];

    if (field.type === "number") {
      output[field.key] =
        value === "" || value === undefined || value === null
          ? null
          : Number(value);
    } else {
      output[field.key] = value ?? null;
    }
  });

  return output;
}

function optionList(field: QuestionField) {
  if (field.type === "likert") {
    return (
      field.scale ?? [
        "Strongly disagree",
        "Disagree",
        "Neutral",
        "Agree",
        "Strongly agree",
      ]
    );
  }

  if (field.type === "yes_no") {
    return ["Yes", "No"];
  }

  return field.options ?? [];
}

function updateQuestionnaireArray(
  items: any[],
  questionnaireId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getQuestionnaireId(item) ?? "");

    if (currentId !== questionnaireId) {
      return item;
    }

    const questionnaire = item.questionnaires ?? null;

    return {
      ...item,
      ...patch,
      questionnaires: questionnaire
        ? {
            ...questionnaire,
            ...patch,
          }
        : item.questionnaires,
    };
  });
}

async function updateQuestionnaireInLocalCache(
  app: any,
  questionnaireId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.questionnaires)) {
    nextCache.questionnaires = updateQuestionnaireArray(
      cache.questionnaires,
      questionnaireId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.questionnaires)) {
    nextCache.data = {
      ...cache.data,
      questionnaires: updateQuestionnaireArray(
        cache.data.questionnaires,
        questionnaireId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.questionnaire_assignments)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      questionnaire_assignments: updateQuestionnaireArray(
        cache.research_care.questionnaire_assignments,
        questionnaireId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.questionnaire_assignments)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        questionnaire_assignments: updateQuestionnaireArray(
          cache.data.research_care.questionnaire_assignments,
          questionnaireId,
          patch
        ),
      },
    };
  }

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // In-memory cache has already been updated.
  }
}

export function QuestionnairesScreen() {
  const app = useAppContext();
  const items = pickQuestionnaires(app);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusMessage(message);
    setStatusType(type);
  }

  function openQuestionnaire(item: any) {
    setSelectedItem(item);
    setAnswers({});
    setStatusMessage("");
    setStatusType("info");
  }

  function backToList() {
    setSelectedItem(null);
    setAnswers({});
    setStatusMessage("");
    setStatusType("info");
  }

  function updateAnswer(key: string, value: any) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
    }));

    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  function toggleCheckbox(key: string, option: string) {
    setAnswers((current) => {
      const existing = Array.isArray(current[key]) ? current[key] : [];

      if (existing.includes(option)) {
        return {
          ...current,
          [key]: existing.filter((item: string) => item !== option),
        };
      }

      return {
        ...current,
        [key]: [...existing, option],
      };
    });

    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  async function submitQuestionnaire() {
    if (!selectedItem) return;

    const questionnaire = getQuestionnaire(selectedItem);
    const fields = getFields(questionnaire);

    if (fields.length === 0) {
      showStatus("This questionnaire does not have questions yet.", "error");
      return;
    }

    const questionnaireIdRaw = getQuestionnaireId(selectedItem);
    const questionnaireId = questionnaireIdRaw ? String(questionnaireIdRaw) : "";

    if (!questionnaireId) {
      showStatus("This questionnaire does not have a valid ID.", "error");
      return;
    }

    const validationError = validateAnswers(fields, answers);

    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    const submittedAt = new Date().toISOString();

    const payload = {
      questionnaire_id: questionnaireId,
      local_id: `questionnaire:${questionnaireId}:${Date.now()}`,
      answers: normaliseAnswers(fields, answers),
      status: "submitted",
      submitted_at: submittedAt,
    };

    setSubmitting(true);
    setStatusMessage("");

    try {
      await apiFetch("/api/participant-app/questionnaires/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateQuestionnaireInLocalCache(app, questionnaireId, {
        submitted_at: submittedAt,
        completed_at: submittedAt,
        response_status: "submitted",
        status: "submitted",
      });

      setSelectedItem(null);
      setAnswers({});
      showStatus("Questionnaire submitted successfully.", "success");
    } catch {
      await enqueueOfflineAction("questionnaire_response", payload);

      await updateQuestionnaireInLocalCache(app, questionnaireId, {
        submitted_at: submittedAt,
        completed_at: submittedAt,
        response_status: "submitted_pending_sync",
        status: "submitted_pending_sync",
      });

      setSelectedItem(null);
      setAnswers({});
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedItem) {
    const questionnaire = getQuestionnaire(selectedItem);
    const fields = getFields(questionnaire);

    return (
      <Screen
        title={questionnaire.title ?? selectedItem.title ?? "Questionnaire"}
        subtitle={
          questionnaire.description ??
          selectedItem.description ??
          "Complete this questionnaire."
        }
      >
        <StatusNotice message={statusMessage} type={statusType} />

        {fields.length === 0 ? (
          <Card
            title="No questions available"
            subtitle="This questionnaire has no form schema yet."
          />
        ) : (
          fields.map((field) => {
            const type = field.type ?? "text";
            const options = optionList(field);

            if (
              type === "radio" ||
              type === "select" ||
              type === "likert" ||
              type === "yes_no"
            ) {
              return (
                <View key={field.key} style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      fontWeight: "900",
                      marginBottom: 8,
                      color: "#171717",
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {field.label}
                  </Text>

                  {options.map((option) => (
                    <Card
                      key={option}
                      title={option}
                      subtitle={
                        answers[field.key] === option
                          ? "Selected"
                          : "Tap to select"
                      }
                      tag={answers[field.key] === option ? "Selected" : null}
                      showOpen={false}
                      onPress={() => updateAnswer(field.key, option)}
                    />
                  ))}
                </View>
              );
            }

            if (type === "checkbox") {
              return (
                <View key={field.key} style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      fontWeight: "900",
                      marginBottom: 8,
                      color: "#171717",
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {field.label}
                  </Text>

                  {options.map((option) => {
                    const selected = Array.isArray(answers[field.key])
                      ? answers[field.key].includes(option)
                      : false;

                    return (
                      <Card
                        key={option}
                        title={option}
                        subtitle={selected ? "Selected" : "Tap to select"}
                        tag={selected ? "Selected" : null}
                        showOpen={false}
                        onPress={() => toggleCheckbox(field.key, option)}
                      />
                    );
                  })}
                </View>
              );
            }

            return (
              <View key={field.key} style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontWeight: "900",
                    marginBottom: 6,
                    color: "#171717",
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  {field.label}
                </Text>

                <TextInput
                  style={{
                    backgroundColor: "white",
                    borderWidth: 1.5,
                    borderColor: "#171717",
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    fontWeight: "800",
                    fontSize: 15,
                    lineHeight: 20,
                    minHeight: type === "textarea" ? 100 : undefined,
                    textAlignVertical: type === "textarea" ? "top" : "center",
                  }}
                  placeholder={field.placeholder ?? "Enter answer"}
                  value={String(answers[field.key] ?? "")}
                  onChangeText={(value) => updateAnswer(field.key, value)}
                  keyboardType={type === "number" ? "numeric" : "default"}
                  multiline={type === "textarea"}
                />
              </View>
            );
          })
        )}

        <AppButton
          label={submitting ? "Submitting..." : "Submit questionnaire"}
          disabled={submitting || fields.length === 0}
          onPress={submitQuestionnaire}
        />

        <AppButton
          label="Back to questionnaires"
          variant="secondary"
          disabled={submitting}
          onPress={backToList}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Questionnaires" subtitle="Complete assigned project forms.">
      <Card
        title="Questionnaire sync check"
        subtitle={`Questionnaires found: ${items.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {items.length === 0 ? (
        <Card
          title="No questionnaires yet"
          subtitle="Pull sync to check assignments."
        />
      ) : (
        items.map((item: any, index: number) => {
          const questionnaire = getQuestionnaire(item);

          return (
            <Card
              key={item.id ?? questionnaire.id ?? index}
              title={questionnaire.title ?? item.title ?? "Questionnaire"}
              subtitle={
                questionnaire.description ??
                item.description ??
                "Tap to complete questionnaire."
              }
              tag={questionnaire.status ?? item.status ?? "active"}
              onPress={() => openQuestionnaire(item)}
            />
          );
        })
      )}
    </Screen>
  );
}