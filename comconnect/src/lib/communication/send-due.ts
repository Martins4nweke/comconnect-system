import { supabaseAdmin } from "@/lib/supabase/admin";
import { queuePushForParticipant } from "@/lib/communication/fallback-engine";
import { personaliseMessage } from "@/lib/communication/personalise-message";
import { sendPushNotification } from "./push-provider";
import { sendSms } from "./sms-provider";
import { startVoiceCall } from "./voice-provider";

function normaliseChannel(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "voice", "whatsapp"].includes(text)) return text;

  return "app";
}

function canFallbackToSms(item: any) {
  const data = item.data ?? item.metadata ?? {};

  if (data.delivery_mode === "app_only") return false;

  if (Array.isArray(data.allowed_channels)) {
    return data.allowed_channels.includes("sms");
  }

  return true;
}

function canFallbackToVoice(item: any) {
  const metadata = item.metadata ?? item.data ?? {};

  if (metadata.delivery_mode === "app_only") return false;

  if (Array.isArray(metadata.allowed_channels)) {
    return metadata.allowed_channels.includes("voice");
  }

  return true;
}

function extractFailureReason(result: any, fallback = "Unknown failure") {
  return (
    result?.error ??
    result?.response?.errorMessage ??
    result?.response?.error ??
    result?.response?.message ??
    result?.response?.description ??
    fallback
  );
}

function extractProviderStatus(result: any) {
  return (
    result?.response?.status ??
    result?.response?.statusCode ??
    result?.response?.SMSMessageData?.Recipients?.[0]?.status ??
    result?.status ??
    null
  );
}

function extractProviderMessageId(result: any) {
  return (
    result?.provider_message_id ??
    result?.response?.messageId ??
    result?.response?.SMSMessageData?.Recipients?.[0]?.messageId ??
    null
  );
}

function extractProviderCost(result: any) {
  const cost =
    result?.response?.cost ??
    result?.response?.SMSMessageData?.Recipients?.[0]?.cost ??
    null;

  if (cost === null || cost === undefined) return null;

  const numericCost = Number(String(cost).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numericCost) ? numericCost : null;
}

async function recordDeliveryEvent(payload: Record<string, any>) {
  const status = String(payload.status ?? "pending");
  const failed = ["failed", "error", "undelivered", "rejected"].includes(
    status.toLowerCase()
  );

  const responsePayload = payload.response_payload ?? {};

  const failureReason =
    payload.failure_reason ??
    payload.error_message ??
    responsePayload?.error ??
    responsePayload?.errorMessage ??
    responsePayload?.message ??
    responsePayload?.description ??
    (failed ? "Provider reported failure" : null);

  const { error } = await supabaseAdmin
    .from("communication_delivery_events")
    .insert({
      ...payload,
      failure_reason: failureReason,
      provider_status:
        payload.provider_status ?? responsePayload?.status ?? status,
      provider_message_id:
        payload.provider_message_id ?? responsePayload?.messageId ?? null,
    });

  if (error) {
    console.warn("communication_delivery_events insert skipped:", error.message);
  }
}

async function markSchedule(
  scheduleId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabaseAdmin
    .from("communication_schedules")
    .update(patch)
    .eq("id", scheduleId);

  if (error) throw new Error(error.message);
}

async function maybeCreateManualFollowUp(item: any, reason: string) {
  await markSchedule(item.id, {
    status: "manual_follow_up",
    last_error: reason,
    failed_at: new Date().toISOString(),
  });

  return {
    id: item.id,
    status: "manual_follow_up",
    reason,
  };
}

export async function processDueSchedules(limit = 100) {
  const now = new Date().toISOString();

  const { data: schedules, error } = await supabaseAdmin
    .from("communication_schedules")
    .select(
      "*, participants(id, participant_code, first_name, last_name, phone_number, preferred_language, metadata)"
    )
    .in("status", ["pending", "retry_pending", "fallback_pending"])
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const item of schedules ?? []) {
    const participant = item.participants;

    if (!participant) {
      results.push(
        await maybeCreateManualFollowUp(item, "Participant not found")
      );
      continue;
    }

    const deliveryMode = item.delivery_mode ?? "participant_preference";

    const requestedChannel = normaliseChannel(
      item.resolved_channel ||
        item.requested_channel ||
        participant?.metadata?.preferred_channel ||
        "app"
    );

    const finalChannel = deliveryMode === "app_only" ? "app" : requestedChannel;

    const title = item.message_title || "ComConnect update";

    const rawBody =
      item.message_body ||
      item.message_title ||
      "You have a ComConnect update. Please open the app.";

    const body = personaliseMessage(rawBody, participant);

    try {
     if (finalChannel === "app") {
  const nowIso = new Date().toISOString();

  const { data: appMessage, error: appMessageError } = await supabaseAdmin
    .from("app_messages")
    .insert({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,

      title,
      body,

      message_code: item.message_code ?? null,
      status: "published",
      available_at: nowIso,

      source_type: "communication_schedules",
      source_id: item.id,

      metadata: {
        type: "scheduled_message",
        source_type: "communication_schedules",
        source_id: item.id,
        message_code: item.message_code,
        delivery_mode: item.delivery_mode,
        allowed_channels: item.allowed_channels,
        created_from: "send_due_app_channel",
      },
    })
    .select("*")
    .single();

  if (appMessageError) {
    throw new Error(appMessageError.message);
  }

  await recordDeliveryEvent({
    organisation_id: item.organisation_id,
    project_id: item.project_id,
    participant_id: item.participant_id,
    phone_number: participant?.phone_number ?? null,
    channel: "app",
    source_type: "communication_schedules",
    source_id: item.id,
    provider: "app_inbox",
    provider_message_id: appMessage?.id ?? null,
    provider_status: "published_to_app_inbox",
    status: "delivered",
    error_message: null,
    failure_reason: null,
    request_payload: {
      title,
      body,
      message_code: item.message_code,
    },
    response_payload: {
      app_message_id: appMessage?.id ?? null,
      available_at: nowIso,
    },
  });

  await queuePushForParticipant({
    project_id: item.project_id,
    participant_id: item.participant_id,
    title,
    body,
    scheduled_for: nowIso,
    data: {
      type: "scheduled_message",
      source_type: "communication_schedules",
      source_id: item.id,
      app_message_id: appMessage?.id ?? null,
      message_code: item.message_code,
      delivery_mode: item.delivery_mode,
      allowed_channels: item.allowed_channels,
    },
  });

  await markSchedule(item.id, {
    status: "queued",
    resolved_channel: "app",
    provider: "app_inbox",
    processed_at: nowIso,
    attempt_count: (item.attempt_count ?? 0) + 1,
    last_error: null,
  });

  results.push({
    id: item.id,
    participant_code: item.participant_code,
    channel: "app",
    status: "delivered_to_app_inbox",
    app_message_id: appMessage?.id ?? null,
    push_alert: "queued_if_token_exists",
  });

  continue;
}

      if (finalChannel === "sms") {
        if (!participant.phone_number) {
          results.push(
            await maybeCreateManualFollowUp(item, "No phone number for SMS")
          );
          continue;
        }

        if ((process.env.SMS_PROVIDER || "disabled") === "disabled") {
          results.push(
            await maybeCreateManualFollowUp(item, "SMS provider disabled")
          );
          continue;
        }

        const { error: smsError } = await supabaseAdmin.from("sms_logs").insert({
          organisation_id: item.organisation_id,
          project_id: item.project_id,
          participant_id: item.participant_id,
          phone_number: participant.phone_number,
          message: body,
          provider: process.env.SMS_PROVIDER || "africastalking",
          status: "pending",
          metadata: {
            source_type: "communication_schedules",
            source_id: item.id,
            message_code: item.message_code,
            delivery_mode: item.delivery_mode,
            allowed_channels: item.allowed_channels,
          },
        });

        if (smsError) throw new Error(smsError.message);

        await markSchedule(item.id, {
          status: "queued",
          resolved_channel: "sms",
          provider: process.env.SMS_PROVIDER || "africastalking",
          processed_at: new Date().toISOString(),
          attempt_count: (item.attempt_count ?? 0) + 1,
          last_error: null,
        });

        results.push({
          id: item.id,
          participant_code: item.participant_code,
          channel: "sms",
          status: "queued",
        });

        continue;
      }

      if (finalChannel === "voice") {
        if (!participant.phone_number) {
          results.push(
            await maybeCreateManualFollowUp(
              item,
              "No phone number for voice call"
            )
          );
          continue;
        }

        if ((process.env.VOICE_PROVIDER || "disabled") === "disabled") {
          results.push(
            await maybeCreateManualFollowUp(item, "Voice provider disabled")
          );
          continue;
        }

        const { error: voiceError } = await supabaseAdmin
          .from("voice_call_tasks")
          .insert({
            organisation_id: item.organisation_id,
            project_id: item.project_id,
            participant_id: item.participant_id,
            phone_number: participant.phone_number,
            reason: title,
            priority: item.priority ?? "normal",
            status: "pending",
            scheduled_for: new Date().toISOString(),
            metadata: {
              source_type: "communication_schedules",
              source_id: item.id,
              message_code: item.message_code,
              message: body,
              delivery_mode: item.delivery_mode,
              allowed_channels: item.allowed_channels,
            },
          });

        if (voiceError) throw new Error(voiceError.message);

        await markSchedule(item.id, {
          status: "queued",
          resolved_channel: "voice",
          provider: process.env.VOICE_PROVIDER || "africastalking",
          processed_at: new Date().toISOString(),
          attempt_count: (item.attempt_count ?? 0) + 1,
          last_error: null,
        });

        results.push({
          id: item.id,
          participant_code: item.participant_code,
          channel: "voice",
          status: "queued",
        });

        continue;
      }

      results.push(
        await maybeCreateManualFollowUp(
          item,
          `Unsupported channel: ${finalChannel}`
        )
      );
    } catch (error: any) {
      await markSchedule(item.id, {
        status: "failed",
        last_error: error.message ?? "Schedule processing failed",
        failed_at: new Date().toISOString(),
      });

      results.push({
        id: item.id,
        participant_code: item.participant_code,
        status: "failed",
        error: error.message ?? "Schedule processing failed",
      });
    }
  }

  return results;
}

export async function processDuePushNotifications(limit = 100) {
  const { data: queue, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select(
      "*, participant_devices(push_token, push_provider, notifications_enabled), participants(participant_code, first_name, last_name, phone_number, preferred_language, metadata)"
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const item of queue ?? []) {
    const device = item.participant_devices;
    const pushToken = device?.push_token;
    const participant = item.participants;

    const body = personaliseMessage(
      item.body || "You have a ComConnect update. Please open the app.",
      participant
    );

    if (!pushToken || device?.notifications_enabled === false) {
      await supabaseAdmin
        .from("push_notification_queue")
        .update({
          status: "failed",
          error_message: "No active push token",
        })
        .eq("id", item.id);

      if (canFallbackToSms(item)) {
        await maybeCreateSmsFallback(item, "No active push token");
      }

      await recordDeliveryEvent({
        organisation_id: item.organisation_id,
        project_id: item.project_id,
        participant_id: item.participant_id,
        device_id: item.device_id,
        phone_number: participant?.phone_number ?? null,
        channel: "push",
        source_type: item.data?.source_type ?? null,
        source_id: item.data?.source_id ?? null,
        provider: "expo",
        status: "failed",
        error_message: "No active push token",
        failure_reason: "No active push token",
        request_payload: {
          title: item.title,
          body,
          data: item.data ?? {},
        },
        response_payload: {},
      });

      results.push({
        id: item.id,
        status: "failed",
        reason: "No active push token",
      });

      continue;
    }

    const result = await sendPushNotification({
      to: pushToken,
      title: item.title,
      body,
      data: item.data ?? {},
    });

    await supabaseAdmin.from("push_notification_logs").insert({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      queue_id: item.id,
      provider: result.provider,
      provider_message_id: result.provider_message_id ?? null,
      status: result.status,
      response: result.response ?? {},
    });

    await recordDeliveryEvent({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      device_id: item.device_id,
      phone_number: participant?.phone_number ?? null,
      channel: "push",
      source_type: item.data?.source_type ?? null,
      source_id: item.data?.source_id ?? null,
      provider: result.provider,
      provider_message_id: extractProviderMessageId(result),
      provider_status: extractProviderStatus(result),
      status: result.status,
      error_message: result.error ?? null,
      failure_reason: result.ok
        ? null
        : extractFailureReason(result, "Push notification failed"),
      request_payload: {
        title: item.title,
        body,
        data: item.data ?? {},
      },
      response_payload: result.response ?? {},
    });

    await supabaseAdmin
      .from("push_notification_queue")
      .update({
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.error ?? null,
      })
      .eq("id", item.id);

    if (!result.ok && canFallbackToSms(item)) {
      await maybeCreateSmsFallback(item, result.error ?? "Push failed");
    }

    results.push({
      id: item.id,
      status: result.status,
      error: result.error ?? null,
    });
  }

  return results;
}

async function maybeCreateSmsFallback(item: any, reason: string) {
  if (!item.participants?.phone_number) return null;

  if ((process.env.SMS_PROVIDER || "disabled") === "disabled") {
    return null;
  }

  const participant = item.participants;

  const message = personaliseMessage(
    item.body || "You have a ComConnect update. Please open the app.",
    participant
  );

  const { data: smsLog, error } = await supabaseAdmin
    .from("sms_logs")
    .insert({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      phone_number: item.participants.phone_number,
      message,
      provider: process.env.SMS_PROVIDER || "africastalking",
      status: "pending",
      metadata: {
        source_type: "push_notification_queue",
        source_id: item.id,
        fallback_reason: reason,
      },
    })
    .select("*")
    .single();

  if (error) {
    console.warn("SMS fallback failed:", error.message);
    return null;
  }

  await supabaseAdmin.from("fallback_message_logs").insert({
    organisation_id: item.organisation_id,
    project_id: item.project_id,
    participant_id: item.participant_id,
    source_type: "push_notification_queue",
    source_id: item.id,
    channel: "sms",
    status: "pending",
    reason,
  });

  return smsLog;
}

export async function processPendingSms(limit = 100) {
  if ((process.env.SMS_PROVIDER || "disabled") === "disabled") {
    return [];
  }

  const { data: smsItems, error } = await supabaseAdmin
    .from("sms_logs")
    .select(
      "*, participants(participant_code, first_name, last_name, phone_number, preferred_language, metadata)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const item of smsItems ?? []) {
    const participant = item.participants;
    const message = personaliseMessage(item.message, participant);

    const result = await sendSms({
      to: item.phone_number,
      message,
    });

    await supabaseAdmin
      .from("sms_logs")
      .update({
        status: result.ok ? "sent" : "failed",
        provider: result.provider,
        provider_message_id: extractProviderMessageId(result),
        error_message: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    await recordDeliveryEvent({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      phone_number: item.phone_number,
      channel: "sms",
      provider: result.provider,
      provider_message_id: extractProviderMessageId(result),
      provider_status: extractProviderStatus(result),
      provider_cost: extractProviderCost(result),
      status: result.status,
      error_message: result.error ?? null,
      failure_reason: result.ok
        ? null
        : extractFailureReason(result, "Africa's Talking SMS failed"),
      request_payload: {
        to: item.phone_number,
        message,
      },
      response_payload: result.response ?? {},
    });

    if (!result.ok && canFallbackToVoice(item)) {
      await maybeCreateVoiceFallback(item, result.error ?? "SMS failed");
    }

    results.push({
      id: item.id,
      status: result.status,
      error: result.error ?? null,
    });
  }

  return results;
}

async function maybeCreateVoiceFallback(item: any, reason: string) {
  if (!item.phone_number) return null;

  if ((process.env.VOICE_PROVIDER || "disabled") === "disabled") {
    return null;
  }

  const message = personaliseMessage(
    item.message || "You have a ComConnect update.",
    item.participants
  );

  const { data, error } = await supabaseAdmin
    .from("voice_call_tasks")
    .insert({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      phone_number: item.phone_number,
      reason,
      priority: "normal",
      status: "pending",
      metadata: {
        source_type: "sms_logs",
        source_id: item.id,
        message,
      },
    })
    .select("*")
    .single();

  if (error) {
    console.warn("Voice fallback failed:", error.message);
    return null;
  }

  return data;
}

export async function processPendingVoiceTasks(limit = 50) {
  if ((process.env.VOICE_PROVIDER || "disabled") === "disabled") {
    return [];
  }

  const { data: calls, error } = await supabaseAdmin
    .from("voice_call_tasks")
    .select(
      "*, participants(participant_code, first_name, last_name, phone_number, preferred_language, metadata)"
    )
    .eq("status", "pending")
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const item of calls ?? []) {
    const participant = item.participants;

    const message = personaliseMessage(
      item.metadata?.message || item.reason || "You have a ComConnect update.",
      participant
    );

    const result = await startVoiceCall({
      to: item.phone_number,
      reason: item.reason,
      message,
    });

    await supabaseAdmin
      .from("voice_call_tasks")
      .update({
        status: result.ok ? "sent" : "failed",
        completed_at: null,
        metadata: {
          ...(item.metadata ?? {}),
          personalised_message: message,
          provider: result.provider,
         provider_message_id: extractProviderMessageId(result),
provider_bulk_id: "provider_bulk_id" in result ? result.provider_bulk_id ?? null : null,
provider_response: result.response ?? {},
provider_error: result.error ?? null,
provider_status_note: result.ok
  ? "Provider accepted request. Final delivery status will come from webhook."
  : null,
        },
      })
      .eq("id", item.id);

    await recordDeliveryEvent({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      participant_id: item.participant_id,
      phone_number: item.phone_number,
      channel: "voice",
      provider: result.provider,
      provider_message_id: extractProviderMessageId(result),
      provider_status: extractProviderStatus(result),
      status: result.status,
      error_message: result.error ?? null,
      failure_reason: result.ok
        ? null
        : extractFailureReason(result, "Africa's Talking voice call failed"),
      request_payload: {
        to: item.phone_number,
        reason: item.reason,
        message,
      },
      response_payload: result.response ?? {},
    });

    results.push({
      id: item.id,
      status: result.status,
      error: result.error ?? null,
    });
  }

  return results;
}

export async function processDueCommunication() {
  const schedules = await processDueSchedules();

  const push = await processDuePushNotifications();
  const sms = await processPendingSms();
  const voice = await processPendingVoiceTasks();

  return {
    schedules,
    push,
    sms,
    voice,
  };
}