import { useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { AppButton } from "../components/AppButton";
import { StatusNotice } from "../components/StatusNotice";
import { useAppContext } from "../context/AppContext";
import { enqueueOfflineAction } from "../storage/offlineQueue";
import { apiFetch } from "../api/client";
import { saveSyncCache } from "../storage/localStore";

type StatusType = "success" | "offline" | "error" | "info";

function pickConsentForms(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.consentForms)
    ? app.consentForms
    : [];

  const fromCacheConsentForms = Array.isArray(cache?.consent_forms)
    ? cache.consent_forms
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.consent_forms
  )
    ? cache.research_care.consent_forms
    : [];

  const fromDataConsentForms = Array.isArray(cache?.data?.consent_forms)
    ? cache.data.consent_forms
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.consent_forms
  )
    ? cache.data.research_care.consent_forms
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheConsentForms.length > 0) return fromCacheConsentForms;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataConsentForms.length > 0) return fromDataConsentForms;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function getConsentId(item: any) {
  return item.id ?? item.consent_form_id;
}

function getConsentVersion(item: any) {
  return item.consent_versions?.[0] ?? item.current_version ?? null;
}

function getConsentText(item: any) {
  const version = getConsentVersion(item);

  return (
    version?.full_text ??
    version?.body ??
    item.body ??
    item.description ??
    "No consent text is available for this form."
  );
}

function getConsentSections(item: any) {
  const version = getConsentVersion(item);

  const sections = [
    {
      title: "Study information",
      text: version?.study_information,
    },
    {
      title: "Privacy information",
      text: version?.privacy_information,
    },
    {
      title: "Risks and benefits",
      text: version?.risks_benefits,
    },
    {
      title: "Voluntary participation",
      text: version?.voluntary_participation,
    },
    {
      title: "Contact details",
      text: version?.contact_details,
    },
  ];

  return sections.filter((section) => Boolean(section.text));
}

function updateConsentArray(
  items: any[],
  consentFormId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getConsentId(item) ?? "");

    if (currentId !== consentFormId) {
      return item;
    }

    return {
      ...item,
      ...patch,
    };
  });
}

async function updateConsentInLocalCache(
  app: any,
  consentFormId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.consent_forms)) {
    nextCache.consent_forms = updateConsentArray(
      cache.consent_forms,
      consentFormId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.consent_forms)) {
    nextCache.data = {
      ...cache.data,
      consent_forms: updateConsentArray(
        cache.data.consent_forms,
        consentFormId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.consent_forms)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      consent_forms: updateConsentArray(
        cache.research_care.consent_forms,
        consentFormId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.consent_forms)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        consent_forms: updateConsentArray(
          cache.data.research_care.consent_forms,
          consentFormId,
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

export function ConsentScreen() {
  const app = useAppContext();
  const items = pickConsentForms(app);

  const [selectedConsent, setSelectedConsent] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusMessage(message);
    setStatusType(type);
  }

  function openConsent(item: any) {
    setSelectedConsent(item);
    setStatusMessage("");
    setStatusType("info");
  }

  function backToConsentList() {
    setSelectedConsent(null);
    setStatusMessage("");
    setStatusType("info");
  }

  async function submitConsent(item: any, accepted: boolean) {
    const version = getConsentVersion(item);

    const consentFormIdRaw = getConsentId(item);
    const consentFormId = consentFormIdRaw ? String(consentFormIdRaw) : "";
    const consentVersionId = version?.id;

    if (!consentFormId || !consentVersionId) {
      showStatus(
        "This consent form does not have a valid published version.",
        "error"
      );
      return;
    }

    const respondedAt = new Date().toISOString();

    const payload = {
      consent_form_id: consentFormId,
      consent_version_id: consentVersionId,
      accepted,
      accepted_at: accepted ? respondedAt : null,
      declined_at: accepted ? null : respondedAt,
      local_id: `consent:${consentVersionId}:${Date.now()}`,
      typed_name: app?.config?.participant?.display_name ?? "Participant",
    };

    setSubmitting(true);
    setStatusMessage("");

    try {
      await apiFetch("/api/participant-app/consent/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateConsentInLocalCache(app, consentFormId, {
        accepted,
        accepted_at: accepted ? respondedAt : null,
        declined_at: accepted ? null : respondedAt,
        consent_response_status: accepted ? "accepted" : "declined",
        response_status: accepted ? "accepted" : "declined",
        status: accepted ? "accepted" : "declined",
      });

      setSelectedConsent(null);

      showStatus(
        accepted
          ? "Consent response saved successfully."
          : "Consent decline saved successfully.",
        "success"
      );
    } catch {
      await enqueueOfflineAction("consent_submission", payload);

      await updateConsentInLocalCache(app, consentFormId, {
        accepted,
        accepted_at: accepted ? respondedAt : null,
        declined_at: accepted ? null : respondedAt,
        consent_response_status: accepted
          ? "accepted_pending_sync"
          : "declined_pending_sync",
        response_status: accepted
          ? "accepted_pending_sync"
          : "declined_pending_sync",
        status: accepted ? "accepted_pending_sync" : "declined_pending_sync",
      });

      setSelectedConsent(null);

      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedConsent) {
    const sections = getConsentSections(selectedConsent);
    const fullText = getConsentText(selectedConsent);

    return (
      <Screen
        title={selectedConsent.title ?? "Consent form"}
        subtitle="Please read the information before choosing an option."
      >
        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title={selectedConsent.title ?? "Consent form"}
          subtitle={
            selectedConsent.description ?? "Review the consent information."
          }
          tag={selectedConsent.status ?? "consent"}
        />

        {sections.length > 0 ? (
          sections.map((section) => (
            <View
              key={section.title}
              style={{
                backgroundColor: "white",
                borderWidth: 1.5,
                borderColor: "#171717",
                borderRadius: 16,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 15,
                  marginBottom: 6,
                  color: "#171717",
                }}
              >
                {section.title}
              </Text>

              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 14,
                  lineHeight: 20,
                  color: "#64748B",
                }}
              >
                {section.text}
              </Text>
            </View>
          ))
        ) : (
          <View
            style={{
              backgroundColor: "white",
              borderWidth: 1.5,
              borderColor: "#171717",
              borderRadius: 16,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight: "600",
                fontSize: 14,
                lineHeight: 20,
                color: "#64748B",
              }}
            >
              {fullText}
            </Text>
          </View>
        )}

        <AppButton
          label={submitting ? "Saving..." : "Accept consent"}
          disabled={submitting}
          onPress={() => submitConsent(selectedConsent, true)}
        />

        <AppButton
          label={submitting ? "Saving..." : "Decline / not now"}
          variant="secondary"
          disabled={submitting}
          onPress={() => submitConsent(selectedConsent, false)}
        />

        <AppButton
          label="Back to consent forms"
          variant="secondary"
          disabled={submitting}
          onPress={backToConsentList}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Consent" subtitle="Review and submit consent forms.">
      <Card
        title="Consent sync check"
        subtitle={`Consent forms found: ${items.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {items.length === 0 ? (
        <Card title="No consent form yet" subtitle="Pull sync to check." />
      ) : (
        items.map((item: any, index: number) => (
          <Card
            key={item.id ?? index}
            title={item.title ?? "Consent form"}
            subtitle={
              item.description ??
              item.body ??
              item.current_version?.body ??
              "Review consent form."
            }
            tag={item.status ?? "published"}
            onPress={() => openConsent(item)}
          />
        ))
      )}
    </Screen>
  );
}