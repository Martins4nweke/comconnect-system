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

type FormField = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
};

function pickObservationTypes(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.observationTypes)
    ? app.observationTypes
    : [];

  const fromCacheObservationTypes = Array.isArray(cache?.observation_types)
    ? cache.observation_types
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.observation_types
  )
    ? cache.research_care.observation_types
    : [];

  const fromDataObservationTypes = Array.isArray(cache?.data?.observation_types)
    ? cache.data.observation_types
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.observation_types
  )
    ? cache.data.research_care.observation_types
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheObservationTypes.length > 0) return fromCacheObservationTypes;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataObservationTypes.length > 0) return fromDataObservationTypes;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function getObservationTypeId(type: any) {
  return type.id ?? type.observation_type_id;
}

function getFields(type: any): FormField[] {
  const fields = type?.form_schema?.fields;

  if (Array.isArray(fields) && fields.length > 0) {
    return fields;
  }

  return [
    {
      key: "value",
      label: type?.name ?? "Response",
      type: "text",
      placeholder: "Enter your response",
      required: true,
    },
  ];
}

function validateFields(fields: FormField[], values: Record<string, string>) {
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? "";

    if (field.required && !value) {
      return `Please complete: ${field.label}`;
    }

    if (field.type === "number" && value) {
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

function buildValues(fields: FormField[], values: Record<string, string>) {
  const output: Record<string, unknown> = {};

  fields.forEach((field) => {
    const rawValue = values[field.key]?.trim() ?? "";

    if (field.type === "number") {
      output[field.key] = rawValue === "" ? null : Number(rawValue);
    } else {
      output[field.key] = rawValue;
    }
  });

  return output;
}

function updateObservationTypeArray(
  items: any[],
  observationTypeId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getObservationTypeId(item) ?? "");

    if (currentId !== observationTypeId) {
      return item;
    }

    return {
      ...item,
      ...patch,
    };
  });
}

async function updateObservationTypeInLocalCache(
  app: any,
  observationTypeId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.observation_types)) {
    nextCache.observation_types = updateObservationTypeArray(
      cache.observation_types,
      observationTypeId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.observation_types)) {
    nextCache.data = {
      ...cache.data,
      observation_types: updateObservationTypeArray(
        cache.data.observation_types,
        observationTypeId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.observation_types)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      observation_types: updateObservationTypeArray(
        cache.research_care.observation_types,
        observationTypeId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.observation_types)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        observation_types: updateObservationTypeArray(
          cache.data.research_care.observation_types,
          observationTypeId,
          patch
        ),
      },
    };
  }

  const currentSubmissions = Array.isArray(cache.health_checkin_submissions)
    ? cache.health_checkin_submissions
    : [];

  nextCache.health_checkin_submissions = [
    ...currentSubmissions,
    {
      observation_type_id: observationTypeId,
      ...patch,
    },
  ];

  app.setCache(nextCache);

  try {
    await saveSyncCache(nextCache);
  } catch {
    // In-memory cache has already been updated.
  }
}

export function HealthCheckinsScreen() {
  const app = useAppContext();
  const types = pickObservationTypes(app);

  const [selectedType, setSelectedType] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusType(type);
    setStatusMessage(message);
  }

  function openForm(type: any) {
    setSelectedType(type);
    setFormValues({});
    setStatusMessage("");
    setStatusType("info");
  }

  function backToList() {
    setSelectedType(null);
    setFormValues({});
    setStatusMessage("");
    setStatusType("info");
  }

  function updateField(key: string, value: string) {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));

    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  async function submitCheckin() {
    if (!selectedType) return;

    const fields = getFields(selectedType);
    const validationError = validateFields(fields, formValues);

    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    const observationTypeIdRaw = getObservationTypeId(selectedType);
    const observationTypeId = observationTypeIdRaw
      ? String(observationTypeIdRaw)
      : "";

    if (!observationTypeId) {
      showStatus("This check-in has no valid ID.", "error");
      return;
    }

    const submittedAt = new Date().toISOString();

    const payload = {
      observation_type_id: observationTypeId,
      local_id: `observation:${observationTypeId}:${Date.now()}`,
      values_json: {
        code: selectedType.code ?? "CHECKIN",
        ...buildValues(fields, formValues),
      },
      severity: "normal",
      alert_status: "none",
      submitted_at: submittedAt,
    };

    setSubmitting(true);
    setStatusMessage("");

    try {
      await apiFetch("/api/participant-app/observations/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateObservationTypeInLocalCache(app, observationTypeId, {
        submitted_at: submittedAt,
        last_submitted_at: submittedAt,
        response_status: "submitted",
        status: selectedType.status ?? "active",
      });

      setSelectedType(null);
      setFormValues({});
      showStatus("Check-in saved successfully.", "success");
    } catch {
      await enqueueOfflineAction("health_observation", payload);

      await updateObservationTypeInLocalCache(app, observationTypeId, {
        submitted_at: submittedAt,
        last_submitted_at: submittedAt,
        response_status: "submitted_pending_sync",
        status: selectedType.status ?? "active",
      });

      setSelectedType(null);
      setFormValues({});
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedType) {
    const fields = getFields(selectedType);

    return (
      <Screen
        title={selectedType.name ?? selectedType.title ?? "Health check-in"}
        subtitle={selectedType.description ?? "Complete this check-in."}
      >
        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title={selectedType.name ?? selectedType.title ?? "Health check-in"}
          subtitle={selectedType.description ?? "Complete this check-in."}
          tag={selectedType.code ?? "check-in"}
        />

        {fields.map((field) => (
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
              }}
              placeholder={field.placeholder ?? "Enter response"}
              keyboardType={field.type === "number" ? "numeric" : "default"}
              value={formValues[field.key] ?? ""}
              onChangeText={(value) => updateField(field.key, value)}
            />
          </View>
        ))}

        <AppButton
          label={submitting ? "Submitting..." : "Submit check-in"}
          disabled={submitting}
          onPress={submitCheckin}
        />

        <AppButton
          label="Back to check-ins"
          variant="secondary"
          disabled={submitting}
          onPress={backToList}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Health Check-ins"
      subtitle="Project-specific check-ins. Not hardcoded to any disease."
    >
      <Card
        title="Check-in sync check"
        subtitle={`Check-ins found: ${types.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {types.length === 0 ? (
        <Card title="No check-ins yet" subtitle="Pull sync to check." />
      ) : (
        types.map((type: any, index: number) => (
          <Card
            key={type.id ?? index}
            title={type.name ?? type.title ?? "Health check-in"}
            subtitle={type.description ?? "Tap to complete this check-in."}
            tag={type.code ?? "check-in"}
            onPress={() => openForm(type)}
          />
        ))
      )}
    </Screen>
  );
}