import { syncPull, syncPush } from "../api/participantAppApi";
import { saveConfig, saveSyncCache } from "../storage/localStore";
import { clearQueue, getQueue, saveQueue } from "../storage/offlineQueue";

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Object.keys(value as Record<string, unknown>).length > 0
  ) {
    return [value];
  }

  return [];
}

function mergeArrays(...values: unknown[]) {
  return values.flatMap((value) => asArray(value));
}

function unwrapApiResponse(response: any) {
  return response?.data ?? response ?? {};
}

export async function pullFromComConnect() {
  /*
    Production-clean sync:
    - No frontend demo fallback.
    - Full pull for now, so completed/read/replied status can refresh properly.
    - Later, incremental sync can be restored carefully after merge logic is stable.
  */

  const response = await syncPull(null);
  const data = unwrapApiResponse(response);

  const researchCare = data.research_care ?? {};
  const placeholders = data.placeholders ?? {};

  const cache: any = {
    config: data.config,

    messages: mergeArrays(
      data.messages,
      researchCare.messages,
      placeholders.messages
    ),

    message_replies: mergeArrays(
      data.message_replies,
      researchCare.message_replies,
      placeholders.message_replies
    ),

    message_events: mergeArrays(
      data.message_events,
      researchCare.message_events,
      placeholders.message_events
    ),

    education_items: mergeArrays(
      researchCare.education_assignments,
      researchCare.education_items,
      data.education_items,
      placeholders.education_items
    ),

    education_progress: mergeArrays(
      data.education_progress,
      researchCare.education_progress,
      data.education_progress_items,
      researchCare.education_progress_items,
      placeholders.education_progress
    ),

    questionnaires: mergeArrays(
      researchCare.questionnaire_assignments,
      researchCare.questionnaires,
      data.questionnaires,
      placeholders.questionnaires
    ),

    questionnaire_responses: mergeArrays(
      data.questionnaire_responses,
      researchCare.questionnaire_responses,
      data.responses,
      researchCare.responses,
      placeholders.questionnaire_responses
    ),

    consent_forms: mergeArrays(
      researchCare.consent_forms,
      researchCare.consent_versions,
      data.consent_forms,
      placeholders.consent_forms
    ),

    participant_consents: mergeArrays(
      data.participant_consents,
      researchCare.participant_consents,
      data.consent_responses,
      researchCare.consent_responses,
      placeholders.participant_consents
    ),

    observation_types: mergeArrays(
      researchCare.observation_types,
      researchCare.project_observation_types,
      data.observation_types,
      placeholders.observation_types
    ),

    health_observations: mergeArrays(
      data.health_observations,
      researchCare.health_observations,
      data.observation_responses,
      researchCare.observation_responses,
      placeholders.health_observations
    ),

    appointments: mergeArrays(
      researchCare.appointments,
      data.appointments,
      placeholders.appointments
    ),

    appointment_responses: mergeArrays(
      data.appointment_responses,
      researchCare.appointment_responses,
      placeholders.appointment_responses
    ),

    referrals: mergeArrays(
      researchCare.referrals,
      data.referrals,
      placeholders.referrals
    ),

    referral_notes: mergeArrays(
      data.referral_notes,
      researchCare.referral_notes,
      data.referral_responses,
      researchCare.referral_responses,
      placeholders.referral_notes
    ),

    help_requests: mergeArrays(
      researchCare.help_requests,
      data.help_requests,
      placeholders.help_requests
    ),

    chat_threads: mergeArrays(
      data.chat_threads,
      researchCare.chat_threads,
      placeholders.chat_threads
    ),

    chat_messages: mergeArrays(
      data.chat_messages,
      researchCare.chat_messages,
      placeholders.chat_messages
    ),

    chat_updates: mergeArrays(
      data.chat_updates,
      researchCare.chat_updates,
      placeholders.chat_updates
    ),

    pulled_at: data.pulled_at ?? new Date().toISOString(),
  };

  if (data.config) {
    await saveConfig(data.config);
  }

  await saveSyncCache(cache);

  return cache;
}

export async function pushOfflineQueue() {
  const queue = await getQueue();

  if (queue.length === 0) {
    return { pushed: 0, failed: 0 };
  }

  const response = await syncPush(queue);
  const result = unwrapApiResponse(response);

  const failedLocalIds = new Set(
    (result.results ?? [])
      .filter((item: any) => item.status === "failed")
      .map((item: any) => item.local_id)
  );

  if (failedLocalIds.size === 0) {
    await clearQueue();
  } else {
    await saveQueue(
      queue.filter((item) => failedLocalIds.has(item.local_id))
    );
  }

  return {
    pushed: result.synced ?? 0,
    failed: result.failed ?? 0,
  };
}