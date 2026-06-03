import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { getParticipantAppConfig } from "@/lib/participant-app/config";
import { recordSyncEvent } from "@/lib/participant-app/sync";
import { getParticipantResearchCarePayload } from "@/lib/research-care/participant-sync";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => ({}));
  const lastSyncedAt = body?.last_synced_at
    ? String(body.last_synced_at)
    : null;

  try {
    const config = await getParticipantAppConfig(auth.context);

    let messagesQuery = supabaseAdmin
      .from("app_messages")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .eq("status", "published")
      .lte("available_at", new Date().toISOString())
      .order("available_at", { ascending: false })
      .limit(200);

    let repliesQuery = supabaseAdmin
      .from("app_message_replies")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("created_at", { ascending: false })
      .limit(100);

    let eventsQuery = supabaseAdmin
      .from("app_message_events")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("created_at", { ascending: false })
      .limit(100);

    let questionnaireResponsesQuery = supabaseAdmin
      .from("questionnaire_responses")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("submitted_at", { ascending: false })
      .limit(200);

    let educationProgressQuery = supabaseAdmin
      .from("education_progress")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("last_viewed_at", { ascending: false })
      .limit(200);

    let consentResponsesQuery = supabaseAdmin
      .from("participant_consents")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("synced_at", { ascending: false })
      .limit(100);

    let appointmentResponsesQuery = supabaseAdmin
      .from("appointment_responses")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("responded_at", { ascending: false })
      .limit(100);

    let chatThreadsQuery = supabaseAdmin
      .from("chat_threads")
      .select("*")
      .eq("participant_id", auth.context.participant_id)
      .eq("project_id", auth.context.project_id)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (lastSyncedAt) {
      messagesQuery = messagesQuery.gte("updated_at", lastSyncedAt);
      repliesQuery = repliesQuery.gte("created_at", lastSyncedAt);
      eventsQuery = eventsQuery.gte("created_at", lastSyncedAt);
      questionnaireResponsesQuery = questionnaireResponsesQuery.gte(
        "synced_at",
        lastSyncedAt
      );
      educationProgressQuery = educationProgressQuery.gte(
        "last_viewed_at",
        lastSyncedAt
      );
      consentResponsesQuery = consentResponsesQuery.gte(
        "synced_at",
        lastSyncedAt
      );
      appointmentResponsesQuery = appointmentResponsesQuery.gte(
        "synced_at",
        lastSyncedAt
      );
      chatThreadsQuery = chatThreadsQuery.gte("updated_at", lastSyncedAt);
    }

    const [
      { data: messages, error: messagesError },
      { data: replies, error: repliesError },
      { data: events, error: eventsError },
      {
        data: questionnaireResponses,
        error: questionnaireResponsesError,
      },
      { data: educationProgress, error: educationProgressError },
      { data: consentResponses, error: consentResponsesError },
      {
        data: appointmentResponses,
        error: appointmentResponsesError,
      },
      { data: chatThreads, error: chatThreadsError },
      researchCare,
    ] = await Promise.all([
      messagesQuery,
      repliesQuery,
      eventsQuery,
      questionnaireResponsesQuery,
      educationProgressQuery,
      consentResponsesQuery,
      appointmentResponsesQuery,
      chatThreadsQuery,
      getParticipantResearchCarePayload(auth.context, lastSyncedAt),
    ]);

    if (messagesError) throw new Error(messagesError.message);
    if (repliesError) throw new Error(repliesError.message);
    if (eventsError) throw new Error(eventsError.message);
    if (questionnaireResponsesError) {
      throw new Error(questionnaireResponsesError.message);
    }
    if (educationProgressError) {
      throw new Error(educationProgressError.message);
    }
    if (consentResponsesError) {
      throw new Error(consentResponsesError.message);
    }
    if (appointmentResponsesError) {
      throw new Error(appointmentResponsesError.message);
    }
    if (chatThreadsError) throw new Error(chatThreadsError.message);

    const threadIds = (chatThreads ?? []).map((thread) => thread.id);

    let chatMessages: any[] = [];

    if (threadIds.length > 0) {
      let chatMessagesQuery = supabaseAdmin
        .from("chat_messages")
        .select("*")
        .in("thread_id", threadIds)
        .eq("participant_id", auth.context.participant_id)
        .eq("project_id", auth.context.project_id)
        .order("created_at", { ascending: true })
        .limit(500);

      if (lastSyncedAt) {
        chatMessagesQuery = chatMessagesQuery.gte(
          "created_at",
          lastSyncedAt
        );
      }

      const { data, error } = await chatMessagesQuery;

      if (error) throw new Error(error.message);

      chatMessages = data ?? [];
    }

    const payload = {
      config,

      messages: messages ?? [],
      message_replies: replies ?? [],
      message_events: events ?? [],

      questionnaire_responses: questionnaireResponses ?? [],
      education_progress: educationProgress ?? [],
      participant_consents: consentResponses ?? [],
      appointment_responses: appointmentResponses ?? [],

      chat_threads: chatThreads ?? [],
      chat_messages: chatMessages,

      research_care: {
        ...researchCare,
        questionnaire_responses: questionnaireResponses ?? [],
        education_progress: educationProgress ?? [],
        participant_consents: consentResponses ?? [],
        appointment_responses: appointmentResponses ?? [],
        chat_threads: researchCare.chat_threads ?? chatThreads ?? [],
        chat_messages: chatMessages,
      },

      pulled_at: new Date().toISOString(),
    };

    const itemCount =
      (messages ?? []).length +
      (replies ?? []).length +
      (events ?? []).length +
      (questionnaireResponses ?? []).length +
      (educationProgress ?? []).length +
      (consentResponses ?? []).length +
      (appointmentResponses ?? []).length +
      (chatThreads ?? []).length +
      chatMessages.length +
      researchCare.education_assignments.length +
      researchCare.questionnaire_assignments.length +
      researchCare.consent_forms.length +
      researchCare.observation_types.length +
      researchCare.appointments.length +
      researchCare.referrals.length +
      researchCare.help_requests.length +
      researchCare.chat_threads.length;

    await recordSyncEvent(auth.context, "pull", itemCount, "success", {
      last_synced_at: lastSyncedAt,
      includes_research_care: true,
      includes_chat_threads: true,
      includes_chat_messages: true,
      includes_questionnaire_responses: true,
      includes_education_progress: true,
      includes_participant_consents: true,
      includes_appointment_responses: true,
    });

    await createAuditLog({
      organisation_id: auth.context.organisation_id,
      project_id: auth.context.project_id,
      actor_type: "participant",
      action: "participant_app.sync_pull",
      entity_type: "participant",
      entity_id: auth.context.participant_id,
      metadata: {
        last_synced_at: lastSyncedAt,
        item_count: itemCount,
        includes_research_care: true,
        includes_chat_threads: true,
        includes_chat_messages: true,
        includes_questionnaire_responses: true,
        includes_education_progress: true,
        includes_participant_consents: true,
        includes_appointment_responses: true,
      },
    });

    return ok(payload);
  } catch (error: any) {
    await recordSyncEvent(auth.context, "pull", 0, "failed", {
      error: error.message ?? "unknown_error",
    });

    return fail(error.message ?? "Sync pull failed", 500);
  }
}