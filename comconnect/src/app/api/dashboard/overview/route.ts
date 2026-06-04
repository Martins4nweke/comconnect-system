import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function sevenDaysAgoIso() {
  const now = new Date();
  now.setDate(now.getDate() - 7);
  return now.toISOString();
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

async function safeCount(params: {
  table: string;
  organisationId?: string;
  projectId?: string;
  status?: string;
  statusColumn?: string;
  dateColumn?: string;
  since?: string;
  extra?: (query: any) => any;
}) {
  try {
    let query = supabaseAdmin
      .from(params.table)
      .select("*", { count: "exact", head: true });

    if (params.organisationId) {
      query = query.eq("organisation_id", params.organisationId);
    }

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (params.status && params.statusColumn) {
      query = query.eq(params.statusColumn, params.status);
    }

    if (params.since && params.dateColumn) {
      query = query.gte(params.dateColumn, params.since);
    }

    if (params.extra) {
      query = params.extra(query);
    }

    const { count, error } = await query;

    if (error) {
      return {
        ok: false,
        count: 0,
        error: error.message,
      };
    }

    return {
      ok: true,
      count: count ?? 0,
      error: null,
    };
  } catch (error: any) {
    return {
      ok: false,
      count: 0,
      error: error?.message ?? `Failed to count ${params.table}`,
    };
  }
}

async function safeRows(params: {
  table: string;
  select: string;
  organisationId?: string;
  projectId?: string;
  status?: string;
  statusColumn?: string;
  dateColumn?: string;
  since?: string;
  orderColumn?: string;
  limit?: number;
  extra?: (query: any) => any;
}) {
  try {
    let query = supabaseAdmin
      .from(params.table)
      .select(params.select)
      .limit(params.limit ?? 10);

    if (params.organisationId) {
      query = query.eq("organisation_id", params.organisationId);
    }

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (params.status && params.statusColumn) {
      query = query.eq(params.statusColumn, params.status);
    }

    if (params.since && params.dateColumn) {
      query = query.gte(params.dateColumn, params.since);
    }

    query = query.order(params.orderColumn ?? params.dateColumn ?? "created_at", {
      ascending: false,
    });

    if (params.extra) {
      query = params.extra(query);
    }

    const { data, error } = await query;

    if (error) {
      return {
        ok: false,
        rows: [],
        error: error.message,
      };
    }

    return {
      ok: true,
      rows: data ?? [],
      error: null,
    };
  } catch (error: any) {
    return {
      ok: false,
      rows: [],
      error: error?.message ?? `Failed to load ${params.table}`,
    };
  }
}

function extractParticipantLabel(row: any) {
  return (
    row?.participants?.display_name ??
    row?.participants?.participant_code ??
    row?.participant_code ??
    "Participant"
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const organisationId = cleanText(url.searchParams.get("organisation_id"));
    const projectId = cleanText(url.searchParams.get("project_id"));

    const today = startOfTodayIso();
    const last7Days = sevenDaysAgoIso();

    const [
      participantsTotal,
      participantsActive,
      participantsToday,
      inboxOpen,
      inboxHigh,
      inboxToday,
      deliveryToday,
      deliveryFailedToday,
      deliverySentToday,
      voicePending,
      voiceFailed,
      healthToday,
      highBpRecent,
      appointmentsOpen,
      referralsOpen,
      educationRecent,
      questionnaireRecent,
      chatRecent,
    ] = await Promise.all([
      safeCount({
        table: "participants",
        organisationId,
        projectId,
      }),

      safeCount({
        table: "participants",
        organisationId,
        projectId,
        extra: (query) =>
          query.or("status.eq.active,is_active.eq.true,archived_at.is.null"),
      }),

      safeCount({
        table: "participants",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
      }),

      safeCount({
        table: "inbox_items",
        organisationId,
        projectId,
        statusColumn: "status",
        status: "open",
      }),

      safeCount({
        table: "inbox_items",
        organisationId,
        projectId,
        extra: (query) =>
          query
            .eq("status", "open")
            .or("priority.eq.high,priority.eq.critical"),
      }),

      safeCount({
        table: "inbox_items",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
      }),

      safeCount({
        table: "communication_delivery_events",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
      }),

      safeCount({
        table: "communication_delivery_events",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
        extra: (query) =>
          query.or(
            "status.eq.failed,status.eq.expired,status.eq.undeliverable,status.eq.error"
          ),
      }),

      safeCount({
        table: "communication_delivery_events",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
        extra: (query) =>
          query.or(
            "status.eq.sent,status.eq.delivered,status.eq.completed,status.eq.submitted_to_provider"
          ),
      }),

      safeCount({
        table: "voice_call_tasks",
        organisationId,
        projectId,
        extra: (query) => query.or("status.eq.pending,status.eq.scheduled,status.eq.sent"),
      }),

      safeCount({
        table: "voice_call_tasks",
        organisationId,
        projectId,
        extra: (query) =>
          query.or("status.eq.failed,status.eq.expired,status.eq.undeliverable"),
      }),

      safeCount({
        table: "health_observations",
        organisationId,
        projectId,
        dateColumn: "submitted_at",
        since: today,
      }),

      safeCount({
        table: "health_observations",
        organisationId,
        projectId,
        dateColumn: "submitted_at",
        since: last7Days,
        extra: (query) =>
          query.or(
            "systolic.gte.140,diastolic.gte.90,value_text.ilike.%high%,alert_level.eq.high,alert_level.eq.critical"
          ),
      }),

      safeCount({
        table: "appointments",
        organisationId,
        projectId,
        extra: (query) => query.or("status.eq.pending,status.eq.scheduled,status.eq.open"),
      }),

      safeCount({
        table: "referrals",
        organisationId,
        projectId,
        extra: (query) => query.or("status.eq.pending,status.eq.open,status.eq.active"),
      }),

      safeCount({
        table: "education_items",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: last7Days,
      }),

      safeCount({
        table: "questionnaires",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: last7Days,
      }),

      safeCount({
        table: "chat_messages",
        organisationId,
        projectId,
        dateColumn: "created_at",
        since: today,
      }),
    ]);

    const [recentInbox, recentFailures, recentHealth, recentChat] =
      await Promise.all([
        safeRows({
          table: "inbox_items",
          select:
            "id, title, summary, source_type, priority, status, participant_id, created_at, participants(participant_code, display_name)",
          organisationId,
          projectId,
          orderColumn: "created_at",
          limit: 8,
        }),

        safeRows({
          table: "communication_delivery_events",
          select:
            "id, participant_id, channel, provider, status, provider_status, failure_reason, error_message, created_at",
          organisationId,
          projectId,
          orderColumn: "created_at",
          limit: 8,
          extra: (query) =>
            query.or(
              "status.eq.failed,status.eq.expired,status.eq.undeliverable,status.eq.error"
            ),
        }),

        safeRows({
          table: "health_observations",
          select:
            "id, participant_id, observation_type, systolic, diastolic, value_text, alert_level, submitted_at, created_at, participants(participant_code, display_name)",
          organisationId,
          projectId,
          orderColumn: "submitted_at",
          limit: 8,
        }),

        safeRows({
          table: "chat_messages",
          select:
            "id, participant_id, thread_id, sender_type, message_text, payload, created_at, participants(participant_code, display_name)",
          organisationId,
          projectId,
          orderColumn: "created_at",
          limit: 8,
        }),
      ]);

    const totalDeliveriesToday = deliveryToday.count;
    const failedDeliveriesToday = deliveryFailedToday.count;
    const sentDeliveriesToday = deliverySentToday.count;

    const alerts = [
      {
        key: "high_inbox",
        title: "High-priority inbox",
        value: inboxHigh.count,
        tone: inboxHigh.count > 0 ? "danger" : "success",
        href: "/inbox",
      },
      {
        key: "failed_deliveries",
        title: "Failed deliveries today",
        value: failedDeliveriesToday,
        tone: failedDeliveriesToday > 0 ? "warning" : "success",
        href: "/delivery-logs",
      },
      {
        key: "high_bp",
        title: "High BP / health alerts",
        value: highBpRecent.count,
        tone: highBpRecent.count > 0 ? "danger" : "success",
        href: "/health-checkins",
      },
      {
        key: "voice_pending",
        title: "Pending voice tasks",
        value: voicePending.count,
        tone: voicePending.count > 0 ? "warning" : "success",
        href: "/voice-tasks",
      },
    ];

    const stats = {
      participants_total: participantsTotal.count,
      participants_active: participantsActive.count,
      participants_added_today: participantsToday.count,
      inbox_open: inboxOpen.count,
      inbox_created_today: inboxToday.count,
      deliveries_today: totalDeliveriesToday,
      deliveries_sent_today: sentDeliveriesToday,
      deliveries_failed_today: failedDeliveriesToday,
      delivery_success_rate: percent(
        totalDeliveriesToday - failedDeliveriesToday,
        totalDeliveriesToday
      ),
      voice_pending: voicePending.count,
      voice_failed: voiceFailed.count,
      chat_messages_today: chatRecent.count,
    };

    const research = {
      education_recent: educationRecent.count,
      questionnaires_recent: questionnaireRecent.count,
    };

    const care = {
      health_checkins_today: healthToday.count,
      high_bp_recent: highBpRecent.count,
      appointments_open: appointmentsOpen.count,
      referrals_open: referralsOpen.count,
    };

    const warnings = [
      participantsTotal.error,
      participantsActive.error,
      participantsToday.error,
      inboxOpen.error,
      inboxHigh.error,
      deliveryToday.error,
      deliveryFailedToday.error,
      voicePending.error,
      healthToday.error,
      highBpRecent.error,
      appointmentsOpen.error,
      referralsOpen.error,
      educationRecent.error,
      questionnaireRecent.error,
      chatRecent.error,
      recentInbox.error,
      recentFailures.error,
      recentHealth.error,
      recentChat.error,
    ].filter(Boolean);

    return ok({
      scope: {
        organisation_id: organisationId || null,
        project_id: projectId || null,
      },
      generated_at: new Date().toISOString(),
      alerts,
      stats,
      communication: {
        deliveries_today: totalDeliveriesToday,
        sent_today: sentDeliveriesToday,
        failed_today: failedDeliveriesToday,
        success_rate: stats.delivery_success_rate,
      },
      research,
      care,
      recent: {
        inbox: recentInbox.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          source_type: row.source_type,
          priority: row.priority,
          status: row.status,
          participant: extractParticipantLabel(row),
          created_at: row.created_at,
          href: "/inbox",
        })),
        failed_deliveries: recentFailures.rows.map((row: any) => ({
          id: row.id,
          participant_id: row.participant_id,
          channel: row.channel,
          provider: row.provider,
          status: row.status,
          provider_status: row.provider_status,
          reason: row.failure_reason ?? row.error_message,
          created_at: row.created_at,
          href: "/delivery-logs",
        })),
        health: recentHealth.rows.map((row: any) => ({
          id: row.id,
          participant: extractParticipantLabel(row),
          observation_type: row.observation_type,
          systolic: row.systolic,
          diastolic: row.diastolic,
          value_text: row.value_text,
          alert_level: row.alert_level,
          submitted_at: row.submitted_at ?? row.created_at,
          href: "/health-checkins",
        })),
        chat: recentChat.rows.map((row: any) => ({
          id: row.id,
          participant: extractParticipantLabel(row),
          sender_type: row.sender_type,
          message_text:
            row.message_text ??
            row.payload?.message_text ??
            row.payload?.message_type ??
            "Chat message",
          created_at: row.created_at,
          href: row.thread_id ? `/chat/${row.thread_id}` : "/chat",
        })),
      },
      warnings,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load dashboard overview", 500);
  }
}