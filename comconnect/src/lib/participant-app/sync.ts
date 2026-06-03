import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ParticipantAppSessionContext, SyncPushItem } from "./types";
import { verifyParticipantMessageAccess } from "./message-security";

export async function recordSyncEvent(
  context: ParticipantAppSessionContext,
  syncType: "pull" | "push",
  itemCount: number,
  status: "success" | "partial" | "failed" = "success",
  metadata: Record<string, unknown> = {}
) {
  await supabaseAdmin.from("sync_events").insert({
    organisation_id: context.organisation_id,
    project_id: context.project_id,
    participant_id: context.participant_id,
    session_id: context.session_id,
    device_id: context.device_id ?? null,
    sync_type: syncType,
    item_count: itemCount,
    status,
    metadata,
  });
}

export async function recordParticipantActivity(
  context: ParticipantAppSessionContext,
  eventType: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  localId?: string | null,
  createdOfflineAt?: string | null
) {
  const eventLocalId =
    localId ??
    `${eventType}:${entityId ?? "none"}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

  const payload = {
    entity_type: entityType,
    entity_id: entityId,
    ...metadata,
  };

  const { error } = await supabaseAdmin.from("participant_app_events").upsert(
    {
      organisation_id: context.organisation_id,
      project_id: context.project_id,
      participant_id: context.participant_id,
      session_id: context.session_id,
      device_id: context.device_id ?? null,
      local_id: eventLocalId,
      event_type: eventType,
      payload,
      created_offline_at: createdOfflineAt ?? null,
    },
    { onConflict: "participant_id,local_id" }
  );

  if (error) {
    console.error("Failed to record participant activity:", error.message);
  }
}

async function ensureEducationItem(
  context: ParticipantAppSessionContext,
  educationItemId: string
) {
  const { data } = await supabaseAdmin
    .from("education_items")
    .select("id")
    .eq("id", educationItemId)
    .eq("project_id", context.project_id)
    .maybeSingle();

  if (!data) throw new Error("Education item not found for this project");
}

async function ensureQuestionnaire(
  context: ParticipantAppSessionContext,
  questionnaireId: string
) {
  const { data } = await supabaseAdmin
    .from("questionnaires")
    .select("id")
    .eq("id", questionnaireId)
    .eq("project_id", context.project_id)
    .maybeSingle();

  if (!data) throw new Error("Questionnaire not found for this project");
}

async function ensureConsentVersion(
  context: ParticipantAppSessionContext,
  consentVersionId: string,
  consentFormId: string
) {
  const { data } = await supabaseAdmin
    .from("consent_versions")
    .select("id, consent_form_id")
    .eq("id", consentVersionId)
    .eq("project_id", context.project_id)
    .maybeSingle();

  if (!data || data.consent_form_id !== consentFormId) {
    throw new Error("Consent version not found for this project/form");
  }
}

async function ensureObservationType(
  context: ParticipantAppSessionContext,
  observationTypeId: string
) {
  const { data } = await supabaseAdmin
    .from("project_observation_types")
    .select("id, code")
    .eq("id", observationTypeId)
    .eq("project_id", context.project_id)
    .maybeSingle();

  if (!data) throw new Error("Observation type not found for this project");

  return data;
}

async function ensureAppointment(
  context: ParticipantAppSessionContext,
  appointmentId: string
) {
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("participant_id", context.participant_id)
    .maybeSingle();

  if (!data) throw new Error("Appointment not found for this participant");
}

async function ensureReferral(
  context: ParticipantAppSessionContext,
  referralId: string
) {
  const { data } = await supabaseAdmin
    .from("referrals")
    .select("id")
    .eq("id", referralId)
    .eq("participant_id", context.participant_id)
    .maybeSingle();

  if (!data) throw new Error("Referral not found for this participant");
}

export async function handleSyncPushItem(
  context: ParticipantAppSessionContext,
  item: SyncPushItem
) {
  const payload = item.payload ?? {};
  const createdOfflineAt = item.created_offline_at ?? null;

  if (item.type === "message_opened") {
    const messageId = String(payload.message_id ?? "");

    if (!messageId) {
      throw new Error("message_opened requires payload.message_id");
    }

    const message = await verifyParticipantMessageAccess(context, messageId);

    if (!message) {
      throw new Error("Message not found for this participant");
    }

    const { error } = await supabaseAdmin.from("app_message_events").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        message_id: messageId,
        device_id: context.device_id ?? null,
        event_type: "opened",
        local_id: item.local_id,
        created_offline_at: createdOfflineAt,
        metadata: payload,
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "message_opened",
      "app_message",
      messageId,
      {
        message_id: messageId,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "message_reply") {
    const messageId = payload.message_id ? String(payload.message_id) : null;
    const replyText = payload.reply_text ? String(payload.reply_text) : null;

    if (messageId) {
      const message = await verifyParticipantMessageAccess(context, messageId);

      if (!message) {
        throw new Error("Message not found for this participant");
      }
    }

    const { error } = await supabaseAdmin.from("app_message_replies").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        message_id: messageId,
        local_id: item.local_id,
        reply_text: replyText,
        reply_payload: payload,
        created_offline_at: createdOfflineAt,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "message_replied",
      "app_message",
      messageId,
      {
        message_id: messageId,
        reply_text: replyText,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "education_progress") {
    const educationItemId = String(payload.education_item_id ?? "");

    if (!educationItemId) {
      throw new Error("education_progress requires education_item_id");
    }

    await ensureEducationItem(context, educationItemId);

    const progressStatus = String(payload.progress_status ?? "viewed");
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin.from("education_progress").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        education_item_id: educationItemId,
        education_version_id: payload.education_version_id ?? null,
        progress_status: progressStatus,
        progress_percent: payload.progress_percent ?? 0,
        local_id: item.local_id,
        created_offline_at: createdOfflineAt,
        last_viewed_at: now,
        completed_at:
          progressStatus === "completed"
            ? payload.completed_at ?? now
            : null,
        metadata: payload.metadata ?? {},
      },
      { onConflict: "participant_id,education_item_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      progressStatus === "completed"
        ? "education_completed"
        : "education_progress",
      "education_item",
      educationItemId,
      {
        education_item_id: educationItemId,
        progress_status: progressStatus,
        progress_percent: payload.progress_percent ?? 0,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "questionnaire_response") {
    const questionnaireId = String(payload.questionnaire_id ?? "");

    if (!questionnaireId) {
      throw new Error("questionnaire_response requires questionnaire_id");
    }

    await ensureQuestionnaire(context, questionnaireId);

    const { error } = await supabaseAdmin.from("questionnaire_responses").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        questionnaire_id: questionnaireId,
        local_id: item.local_id,
        answers: payload.answers ?? {},
        status: payload.status ?? "submitted",
        score: payload.score ?? {},
        created_offline_at: createdOfflineAt,
        submitted_at: payload.submitted_at ?? new Date().toISOString(),
        synced_at: new Date().toISOString(),
        metadata: payload.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "questionnaire_submitted",
      "questionnaire",
      questionnaireId,
      {
        questionnaire_id: questionnaireId,
        status: payload.status ?? "submitted",
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "consent_submission") {
    const consentFormId = String(payload.consent_form_id ?? "");
    const consentVersionId = String(payload.consent_version_id ?? "");

    if (!consentFormId || !consentVersionId) {
      throw new Error(
        "consent_submission requires consent_form_id and consent_version_id"
      );
    }

    await ensureConsentVersion(context, consentVersionId, consentFormId);

    const accepted = Boolean(payload.accepted);
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin.from("participant_consents").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        consent_form_id: consentFormId,
        consent_version_id: consentVersionId,
        local_id: item.local_id,
        accepted,
        typed_name: payload.typed_name ?? null,
        signature_url: payload.signature_url ?? null,
        language: payload.language ?? null,
        created_offline_at: createdOfflineAt,
        accepted_at: accepted ? payload.accepted_at ?? now : null,
        synced_at: now,
        metadata: {
          ...(typeof payload.metadata === "object" && payload.metadata
            ? payload.metadata
            : {}),
          declined_at: accepted ? null : payload.declined_at ?? now,
        },
      },
      { onConflict: "participant_id,consent_version_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      accepted ? "consent_accepted" : "consent_declined",
      "consent_form",
      consentFormId,
      {
        consent_form_id: consentFormId,
        consent_version_id: consentVersionId,
        accepted,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "health_observation") {
    const observationTypeId = String(payload.observation_type_id ?? "");

    if (!observationTypeId) {
      throw new Error("health_observation requires observation_type_id");
    }

    const obsType = await ensureObservationType(context, observationTypeId);

    const { error } = await supabaseAdmin.from("health_observations").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        observation_type_id: observationTypeId,
        observation_code: obsType.code,
        local_id: item.local_id,
        values_json: payload.values_json ?? {},
        severity: payload.severity ?? "normal",
        alert_status: payload.alert_status ?? "none",
        created_offline_at: createdOfflineAt,
        submitted_at: payload.submitted_at ?? new Date().toISOString(),
        synced_at: new Date().toISOString(),
        metadata: payload.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "health_observation_submitted",
      "observation_type",
      observationTypeId,
      {
        observation_type_id: observationTypeId,
        observation_code: obsType.code,
        severity: payload.severity ?? "normal",
        alert_status: payload.alert_status ?? "none",
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "appointment_response") {
    const appointmentId = String(payload.appointment_id ?? "");

    if (!appointmentId) {
      throw new Error("appointment_response requires appointment_id");
    }

    await ensureAppointment(context, appointmentId);

    const { error } = await supabaseAdmin.from("appointment_responses").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        appointment_id: appointmentId,
        local_id: item.local_id,
        response: payload.response ?? "confirmed",
        note: payload.note ?? null,
        requested_new_time: payload.requested_new_time ?? null,
        created_offline_at: createdOfflineAt,
        responded_at: payload.responded_at ?? new Date().toISOString(),
        synced_at: new Date().toISOString(),
        metadata: payload.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "appointment_responded",
      "appointment",
      appointmentId,
      {
        appointment_id: appointmentId,
        response: payload.response ?? "confirmed",
        requested_new_time: payload.requested_new_time ?? null,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "referral_response") {
    const referralId = String(payload.referral_id ?? "");

    if (!referralId) {
      throw new Error("referral_response requires referral_id");
    }

    await ensureReferral(context, referralId);

    const { error } = await supabaseAdmin.from("referral_notes").insert({
      organisation_id: context.organisation_id,
      project_id: context.project_id,
      referral_id: referralId,
      participant_id: context.participant_id,
      note: payload.note ?? payload.response ?? "Participant responded via app.",
    });

    if (error) throw new Error(error.message);

    if (payload.status) {
      await supabaseAdmin
        .from("referrals")
        .update({ status: payload.status })
        .eq("id", referralId);
    }

    await recordParticipantActivity(
      context,
      "referral_responded",
      "referral",
      referralId,
      {
        referral_id: referralId,
        status: payload.status ?? null,
        response: payload.response ?? null,
        note: payload.note ?? null,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "help_request") {
    const { error } = await supabaseAdmin.from("help_requests").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        local_id: item.local_id,
        category: payload.category ?? "general",
        message: payload.message ?? null,
        priority: payload.priority ?? "normal",
        status: "open",
        created_offline_at: createdOfflineAt,
        synced_at: new Date().toISOString(),
        metadata: payload.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await recordParticipantActivity(
      context,
      "help_request_submitted",
      "help_request",
      item.local_id,
      {
        category: payload.category ?? "general",
        message: payload.message ?? null,
        priority: payload.priority ?? "normal",
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  if (item.type === "chat_read") {
    const threadId = payload.thread_id ? String(payload.thread_id) : null;
    const readAt = payload.read_at
      ? String(payload.read_at)
      : new Date().toISOString();

    if (threadId) {
      const { data: thread } = await supabaseAdmin
        .from("chat_threads")
        .select("id")
        .eq("id", threadId)
        .eq("participant_id", context.participant_id)
        .maybeSingle();

      if (!thread) {
        throw new Error("Chat thread not found for this participant");
      }

      const { error: messagesError } = await supabaseAdmin
        .from("chat_messages")
        .update({
          read_at: readAt,
          updated_at: readAt,
        })
        .eq("thread_id", threadId)
        .eq("participant_id", context.participant_id)
        .neq("sender_type", "participant");

      if (messagesError) {
        throw new Error(messagesError.message);
      }

      await recordParticipantActivity(
        context,
        "chat_thread_read",
        "chat_thread",
        threadId,
        {
          thread_id: threadId,
          read_at: readAt,
          source: "offline_sync",
          ...payload,
        },
        item.local_id,
        createdOfflineAt
      );

      return {
        local_id: item.local_id,
        status: "synced",
        type: item.type,
      };
    }

    const { data: threads, error: threadError } = await supabaseAdmin
      .from("chat_threads")
      .select("id")
      .eq("participant_id", context.participant_id)
      .eq("project_id", context.project_id);

    if (threadError) {
      throw new Error(threadError.message);
    }

    const threadIds = (threads ?? []).map((thread) => thread.id);

    if (threadIds.length > 0) {
      const { error: messagesError } = await supabaseAdmin
        .from("chat_messages")
        .update({
          read_at: readAt,
          updated_at: readAt,
        })
        .in("thread_id", threadIds)
        .eq("participant_id", context.participant_id)
        .neq("sender_type", "participant");

      if (messagesError) {
        throw new Error(messagesError.message);
      }
    }

    await recordParticipantActivity(
      context,
      "chat_read",
      "chat",
      null,
      {
        thread_ids: threadIds,
        read_at: readAt,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return {
      local_id: item.local_id,
      status: "synced",
      type: item.type,
    };
  }  

if (item.type === "chat_message") {
    let threadId = payload.thread_id ? String(payload.thread_id) : null;

    if (threadId) {
      const { data: thread } = await supabaseAdmin
        .from("chat_threads")
        .select("id")
        .eq("id", threadId)
        .eq("participant_id", context.participant_id)
        .maybeSingle();

      if (!thread) {
        throw new Error("Chat thread not found for this participant");
      }
    } else {
      const { data: newThread, error: threadError } = await supabaseAdmin
        .from("chat_threads")
        .insert({
          organisation_id: context.organisation_id,
          project_id: context.project_id,
          participant_id: context.participant_id,
          subject: payload.subject ?? "Participant message",
          status: "open",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (threadError) throw new Error(threadError.message);

      threadId = newThread.id;
    }

    const { error } = await supabaseAdmin.from("chat_messages").upsert(
      {
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        thread_id: threadId,
        participant_id: context.participant_id,
        sender_type: "participant",
        local_id: item.local_id,
        message_text: payload.message_text ?? null,
        payload: payload.payload ?? payload,
        created_offline_at: createdOfflineAt,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,local_id" }
    );

    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    await recordParticipantActivity(
      context,
      "chat_message_sent",
      "chat_thread",
      threadId,
      {
        thread_id: threadId,
        message_text: payload.message_text ?? null,
        source: "offline_sync",
        ...payload,
      },
      item.local_id,
      createdOfflineAt
    );

    return { local_id: item.local_id, status: "synced", type: item.type };
  }

  const { error } = await supabaseAdmin.from("participant_app_events").upsert(
    {
      organisation_id: context.organisation_id,
      project_id: context.project_id,
      participant_id: context.participant_id,
      session_id: context.session_id,
      device_id: context.device_id ?? null,
      local_id: item.local_id,
      event_type: item.type,
      payload: {
        entity_type: "unknown",
        entity_id: null,
        source: "offline_sync",
        ...payload,
      },
      created_offline_at: createdOfflineAt,
    },
    { onConflict: "participant_id,local_id" }
  );

  if (error) throw new Error(error.message);

  return { local_id: item.local_id, status: "synced", type: item.type };
}