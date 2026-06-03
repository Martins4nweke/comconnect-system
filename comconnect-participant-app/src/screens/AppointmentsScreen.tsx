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

type AppointmentResponse =
  | "confirmed"
  | "reschedule_requested"
  | "declined";

function pickAppointments(app: any) {
  const cache = app.cache as any;

  const fromContext = Array.isArray(app.appointments)
    ? app.appointments
    : [];

  const fromCacheAppointments = Array.isArray(cache?.appointments)
    ? cache.appointments
    : [];

  const fromCacheResearchCare = Array.isArray(
    cache?.research_care?.appointments
  )
    ? cache.research_care.appointments
    : [];

  const fromDataAppointments = Array.isArray(cache?.data?.appointments)
    ? cache.data.appointments
    : [];

  const fromDataResearchCare = Array.isArray(
    cache?.data?.research_care?.appointments
  )
    ? cache.data.research_care.appointments
    : [];

  if (fromContext.length > 0) return fromContext;
  if (fromCacheAppointments.length > 0) return fromCacheAppointments;
  if (fromCacheResearchCare.length > 0) return fromCacheResearchCare;
  if (fromDataAppointments.length > 0) return fromDataAppointments;
  if (fromDataResearchCare.length > 0) return fromDataResearchCare;

  return [];
}

function formatAppointmentDate(value: any) {
  const raw =
    value?.appointment_at ??
    value?.start_at ??
    value?.scheduled_at ??
    null;

  if (!raw) return "Date not set";

  try {
    return new Date(raw).toLocaleString();
  } catch {
    return String(raw);
  }
}

function responseLabel(response: AppointmentResponse) {
  if (response === "confirmed") {
    return "Appointment confirmed successfully.";
  }

  if (response === "reschedule_requested") {
    return "Reschedule request submitted successfully.";
  }

  return "Appointment decline saved successfully.";
}

function getAppointmentId(item: any) {
  return item.id ?? item.appointment_id;
}

function updateAppointmentArray(
  items: any[],
  appointmentId: string,
  patch: Record<string, any>
) {
  return items.map((item: any) => {
    const currentId = String(getAppointmentId(item) ?? "");

    if (currentId !== appointmentId) {
      return item;
    }

    return {
      ...item,
      ...patch,
    };
  });
}

async function updateAppointmentInLocalCache(
  app: any,
  appointmentId: string,
  patch: Record<string, any>
) {
  const cache = app.cache as any;

  if (!cache) return;

  const nextCache = {
    ...cache,
  };

  if (Array.isArray(cache.appointments)) {
    nextCache.appointments = updateAppointmentArray(
      cache.appointments,
      appointmentId,
      patch
    );
  }

  if (cache.data && Array.isArray(cache.data.appointments)) {
    nextCache.data = {
      ...cache.data,
      appointments: updateAppointmentArray(
        cache.data.appointments,
        appointmentId,
        patch
      ),
    };
  }

  if (
    cache.research_care &&
    Array.isArray(cache.research_care.appointments)
  ) {
    nextCache.research_care = {
      ...cache.research_care,
      appointments: updateAppointmentArray(
        cache.research_care.appointments,
        appointmentId,
        patch
      ),
    };
  }

  if (
    cache.data?.research_care &&
    Array.isArray(cache.data.research_care.appointments)
  ) {
    nextCache.data = {
      ...nextCache.data,
      research_care: {
        ...cache.data.research_care,
        appointments: updateAppointmentArray(
          cache.data.research_care.appointments,
          appointmentId,
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

export function AppointmentsScreen() {
  const app = useAppContext();
  const appointments = pickAppointments(app);

  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(
    null
  );
  const [note, setNote] = useState("");
  const [requestedNewTime, setRequestedNewTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("info");

  function showStatus(message: string, type: StatusType) {
    setStatusMessage(message);
    setStatusType(type);
  }

  function openAppointment(item: any) {
    setSelectedAppointment(item);
    setNote("");
    setRequestedNewTime("");
    setStatusMessage("");
    setStatusType("info");
  }

  function backToAppointments() {
    setSelectedAppointment(null);
    setNote("");
    setRequestedNewTime("");
    setStatusMessage("");
    setStatusType("info");
  }

  function clearErrorIfNeeded() {
    if (statusType === "error") {
      setStatusMessage("");
      setStatusType("info");
    }
  }

  async function respond(
    appointment: any,
    response: AppointmentResponse
  ) {
    const appointmentIdRaw = getAppointmentId(appointment);
    const appointmentId = appointmentIdRaw ? String(appointmentIdRaw) : "";

    if (!appointmentId) {
      showStatus("This appointment does not have a valid ID.", "error");
      return;
    }

    if (response === "reschedule_requested" && !requestedNewTime.trim()) {
      showStatus("Please type your preferred new appointment time.", "error");
      return;
    }

    const respondedAt = new Date().toISOString();

    const payload = {
      appointment_id: appointmentId,
      response,
      note: note.trim() || null,
      requested_new_time:
        response === "reschedule_requested"
          ? requestedNewTime.trim()
          : null,
      responded_at: respondedAt,
      local_id: `appointment:${appointmentId}:${Date.now()}`,
    };

    setSubmitting(true);
    setStatusMessage("");

    try {
      await apiFetch("/api/participant-app/appointments/respond", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateAppointmentInLocalCache(app, appointmentId, {
        participant_response: response,
        response,
        responded_at: respondedAt,
        response_status: response,
        requested_new_time:
          response === "reschedule_requested"
            ? requestedNewTime.trim()
            : null,
        note: note.trim() || null,
        status:
          response === "confirmed"
            ? "confirmed"
            : response === "declined"
              ? "declined"
              : "reschedule_requested",
      });

      setSelectedAppointment(null);
      setNote("");
      setRequestedNewTime("");
      showStatus(responseLabel(response), "success");
    } catch {
      await enqueueOfflineAction("appointment_response", payload);

      await updateAppointmentInLocalCache(app, appointmentId, {
        participant_response: response,
        response,
        responded_at: respondedAt,
        response_status: `${response}_pending_sync`,
        requested_new_time:
          response === "reschedule_requested"
            ? requestedNewTime.trim()
            : null,
        note: note.trim() || null,
        status: `${response}_pending_sync`,
      });

      setSelectedAppointment(null);
      setNote("");
      setRequestedNewTime("");
      showStatus(
        "Saved offline. It will send automatically when internet returns.",
        "offline"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedAppointment) {
    return (
      <Screen
        title={selectedAppointment.title ?? "Appointment"}
        subtitle="Review appointment details and choose a response."
      >
        <StatusNotice message={statusMessage} type={statusType} />

        <Card
          title={
            selectedAppointment.title ??
            selectedAppointment.appointment_type ??
            "Appointment"
          }
          subtitle={selectedAppointment.description ?? "Appointment details"}
          tag={selectedAppointment.status ?? "scheduled"}
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
          <Text style={{ fontWeight: "900", marginBottom: 6 }}>
            Date and time
          </Text>

          <Text
            style={{
              fontWeight: "700",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            {formatAppointmentDate(selectedAppointment)}
          </Text>

          <Text
            style={{
              fontWeight: "900",
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            Location
          </Text>

          <Text
            style={{
              fontWeight: "700",
              color: "#64748B",
              lineHeight: 20,
            }}
          >
            {selectedAppointment.location ?? "Location not set"}
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

        <Text style={{ fontWeight: "900", marginBottom: 6 }}>
          Preferred new time, if requesting reschedule
        </Text>

        <TextInput
          style={{
            backgroundColor: "white",
            borderWidth: 1.5,
            borderColor: "#171717",
            borderRadius: 16,
            padding: 12,
            fontWeight: "800",
            marginBottom: 10,
          }}
          placeholder="e.g. Next Tuesday morning"
          value={requestedNewTime}
          onChangeText={(value) => {
            setRequestedNewTime(value);
            clearErrorIfNeeded();
          }}
        />

        <AppButton
          label={submitting ? "Saving..." : "Confirm appointment"}
          disabled={submitting}
          onPress={() => respond(selectedAppointment, "confirmed")}
        />

        <AppButton
          label={submitting ? "Saving..." : "Request reschedule"}
          variant="secondary"
          disabled={submitting}
          onPress={() => respond(selectedAppointment, "reschedule_requested")}
        />

        <AppButton
          label={submitting ? "Saving..." : "Decline / cannot attend"}
          variant="secondary"
          disabled={submitting}
          onPress={() => respond(selectedAppointment, "declined")}
        />

        <AppButton
          label="Back to appointments"
          variant="secondary"
          disabled={submitting}
          onPress={backToAppointments}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Appointments"
      subtitle="Confirm or request changes to appointments."
    >
      <Card
        title="Appointment sync check"
        subtitle={`Appointments found: ${appointments.length}`}
      />

      <StatusNotice message={statusMessage} type={statusType} />

      {appointments.length === 0 ? (
        <Card
          title="No appointments yet"
          subtitle="Pull sync to check."
        />
      ) : (
        appointments.map((item: any, index: number) => (
          <Card
            key={item.id ?? index}
            title={item.title ?? item.appointment_type ?? "Appointment"}
            subtitle={
              item.description ??
              `${item.location ?? "Location not set"} | ${formatAppointmentDate(
                item
              )}`
            }
            tag={item.status ?? "scheduled"}
            onPress={() => openAppointment(item)}
          />
        ))
      )}
    </Screen>
  );
}