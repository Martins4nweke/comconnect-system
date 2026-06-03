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

type ReferralResponseStatus =
  | "viewed"
  | "contacted"
  | "attended"
  | "needs_help";

function pickReferrals(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.referrals)
    ? app.referrals
    : [];

  const fromCacheReferrals = Array.isArray(cache?.referrals)
    ? cache.referrals
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.referrals
  )
    ? cache.research_care.referrals
    : [];

  const fromDataReferrals = Array.isArray(cache?.data?.referrals)
    ? cache.data.referrals
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.referrals
  )
    ? cache.data.research_care.referrals
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheReferrals.length > 0) return fromCacheReferrals;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataReferrals.length > 0) return fromDataReferrals;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function getReferralId(item: any) {
  return item.id ?? item.referral_id;
}

function getReferralTitle(item: any) {
  return (
    item.referral_type ??
    item.title ??
    item.referral_destination ??
    "Referral"
  );
}

function getReferralReason(item: any) {
  return (
    item.referral_reason ??
    item.reason ??
    item.description ??
    "Referral details"
  );
}

function getReferralDestination(item: any) {
  return (
    item.referral_destination ??
    item.destination ??
    item.facility_name ??
    item.clinic_name ??
    "Destination not set"
  );
}

function getReferralPriority(item: any) {
  return item.priority ?? "Not specified";
}

function getResponseText(status: ReferralResponseStatus) {
  if (status === "viewed") return "Participant viewed referral";
  if (status === "contacted") return "Participant confirmed contact";
  if (status === "attended") return "Participant reported attending referral";
  return "Participant needs help with referral";
}

function getSuccessMessage(status: ReferralResponseStatus) {
  if (status === "viewed") return "Referral marked as viewed.";
  if (status === "contacted") return "Clinic contact response saved.";
  if (status === "attended") return "Referral attendance response saved.";
  return "Help request for this referral saved.";
}

function getLocalReferralStatus(status: ReferralResponseStatus) {
  if (status === "viewed") return "viewed";
  if (status === "contacted") return "contacted";
  if (status === "attended") return "attended";
  return "needs_help";
}

function updateReferralArray(
  items: any[],
  referralId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getReferralId(item) ?? "");

    if (currentId !== referralId) {
      return item;
    }

    return {
      ...item,
      ...patch,
    };
  });
}

async function updateReferralInLocalCache(
  app: any,
  referralId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.referrals)) {
    nextCache.referrals = updateReferralArray(
      cache.referrals,
      referralId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.referrals)) {
    nextCache.data = {
      ...cache.data,
      referrals: updateReferralArray(
        cache.data.referrals,
        referralId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.referrals)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      referrals: updateReferralArray(
        cache.research_care.referrals,
        referralId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.referrals)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        referrals: updateReferralArray(
          cache.data.research_care.referrals,
          referralId,
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

export function ReferralsScreen() {
  const app = useAppContext();
  const referrals = pickReferrals(app);

  const [selectedReferral, setSelectedReferral] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusMessage(message);
    setStatusType(type);
  }

  function openReferral(item: any) {
    setSelectedReferral(item);
    setNote("");
    setStatusMessage("");
    setStatusType("info");
  }

  function backToReferrals() {
    setSelectedReferral(null);
    setNote("");
    setStatusMessage("");
    setStatusType("info");
  }

  function clearErrorIfNeeded() {
    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  async function respond(referral: any, status: ReferralResponseStatus) {
    const referralIdRaw = getReferralId(referral);
    const referralId = referralIdRaw ? String(referralIdRaw) : "";

    if (!referralId) {
      showStatus("This referral does not have a valid ID.", "error");
      return;
    }

    const responseText = getResponseText(status);
    const respondedAt = new Date().toISOString();

    const payload = {
      referral_id: referralId,
      response: responseText,
      status,
      note: note.trim() || responseText,
      responded_at: respondedAt,
      local_id: `referral:${referralId}:${Date.now()}`,
    };

    setSubmitting(true);
    setStatusMessage("");

    try {
      await apiFetch("/api/participant-app/referrals/respond", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateReferralInLocalCache(app, referralId, {
        status: getLocalReferralStatus(status),
        participant_response_status: status,
        response_status: status,
        responded_at: respondedAt,
        participant_responded_at: respondedAt,
        note: note.trim() || responseText,
      });

      setSelectedReferral(null);
      setNote("");
      showStatus(getSuccessMessage(status), "success");
    } catch {
      await enqueueOfflineAction("referral_response", payload);

      await updateReferralInLocalCache(app, referralId, {
        status: `${getLocalReferralStatus(status)}_pending_sync`,
        participant_response_status: `${status}_pending_sync`,
        response_status: `${status}_pending_sync`,
        responded_at: respondedAt,
        participant_responded_at: respondedAt,
        note: note.trim() || responseText,
      });

      setSelectedReferral(null);
      setNote("");
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedReferral) {
    return (
      <Screen
        title={getReferralTitle(selectedReferral)}
        subtitle="Review referral details and choose a response."
      >
        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title={getReferralTitle(selectedReferral)}
          subtitle={getReferralReason(selectedReferral)}
          tag={selectedReferral.status ?? selectedReferral.priority ?? "open"}
        />

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
          <Text style={{ fontWeight: "900", marginBottom: 6 }}>Reason</Text>

          <Text
            style={{
              fontWeight: "700",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            {getReferralReason(selectedReferral)}
          </Text>

          <Text
            style={{
              fontWeight: "900",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            Destination
          </Text>

          <Text
            style={{
              fontWeight: "700",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            {getReferralDestination(selectedReferral)}
          </Text>

          <Text
            style={{
              fontWeight: "900",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            Priority
          </Text>

          <Text
            style={{
              fontWeight: "700",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            {getReferralPriority(selectedReferral)}
          </Text>
        </View>

        <Text style={{ fontWeight: "900", marginBottom: 6 }}>
          Optional note
        </Text>

        <TextInput
          style={{
            backgroundColor: "white",
            borderWidth: 1.5,
            borderColor: "#171717",
            borderRadius: 16,
            padding: 12,
            fontWeight: "800",
            minHeight: 80,
            textAlignVertical: "top",
            marginBottom: 10,
          }}
          placeholder="Add a note if needed"
          value={note}
          onChangeText={(value) => {
            setNote(value);
            clearErrorIfNeeded();
          }}
          multiline
        />

        <AppButton
          label={submitting ? "Saving..." : "I have viewed this referral"}
          disabled={submitting}
          onPress={() => respond(selectedReferral, "viewed")}
        />

        <AppButton
          label={submitting ? "Saving..." : "I have contacted the clinic"}
          variant="secondary"
          disabled={submitting}
          onPress={() => respond(selectedReferral, "contacted")}
        />

        <AppButton
          label={submitting ? "Saving..." : "I attended the referral"}
          variant="secondary"
          disabled={submitting}
          onPress={() => respond(selectedReferral, "attended")}
        />

        <AppButton
          label={submitting ? "Saving..." : "I need help with this referral"}
          variant="secondary"
          disabled={submitting}
          onPress={() => respond(selectedReferral, "needs_help")}
        />

        <AppButton
          label="Back to referrals"
          variant="secondary"
          disabled={submitting}
          onPress={backToReferrals}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Referrals"
      subtitle="View referral and follow-up information."
    >
      <Card
        title="Referral sync check"
        subtitle={`Referrals found: ${referrals.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {referrals.length === 0 ? (
        <Card
          title="No referrals yet"
          subtitle="Pull sync to check."
        />
      ) : (
        referrals.map((item: any, index: number) => (
          <Card
            key={item.id ?? index}
            title={getReferralTitle(item)}
            subtitle={getReferralReason(item)}
            tag={item.status ?? item.priority ?? "open"}
            onPress={() => openReferral(item)}
          />
        ))
      )}
    </Screen>
  );
}