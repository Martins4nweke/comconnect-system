import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const API_USAGE_ROLES = new Set([
  "platform_owner",
  "superadmin",
  "organisation_admin",
  "developer_admin",
  "billing_admin",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isApiUsageAllowed(role?: string | null) {
  return API_USAGE_ROLES.has(cleanText(role).toLowerCase());
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return user;
}

async function getActiveMembership(params: {
  userId: string;
  email: string;
}) {
  const { data: byUserId, error: byUserIdError } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byUserIdError) {
    throw new Error(byUserIdError.message);
  }

  if (byUserId) return byUserId;

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("email", params.email)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byEmailError) {
    throw new Error(byEmailError.message);
  }

  return byEmail;
}

async function requireApiUsageAccess() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Not authenticated.",
      status: 401,
      user: null,
      membership: null,
    };
  }

  const email = cleanText(user.email).toLowerCase();

  const membership = await getActiveMembership({
    userId: user.id,
    email,
  });

  if (!membership?.organisation_id) {
    return {
      ok: false as const,
      error: "No active organisation membership found.",
      status: 403,
      user,
      membership: null,
    };
  }

  if (!isApiUsageAllowed(membership.role)) {
    return {
      ok: false as const,
      error: "You are not allowed to view API usage.",
      status: 403,
      user,
      membership,
    };
  }

  return {
    ok: true as const,
    user,
    membership,
  };
}

function startOfCurrentMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUsageAccess();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const url = new URL(req.url);
    const limitText = cleanText(url.searchParams.get("limit"));
    const limit = Math.min(Math.max(Number(limitText) || 50, 1), 200);

    const organisationId = auth.membership.organisation_id;
    const monthStart = startOfCurrentMonth();

    const { count: totalRequests, error: totalError } = await supabaseAdmin
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .gte("created_at", monthStart);

    if (totalError) {
      return fail(totalError.message, 500);
    }

    const { count: failedRequests, error: failedError } = await supabaseAdmin
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .gte("created_at", monthStart)
      .gte("status_code", 400);

    if (failedError) {
      return fail(failedError.message, 500);
    }

    const { count: paidChannelSends, error: paidError } = await supabaseAdmin
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .gte("created_at", monthStart)
      .eq("paid_channel", true);

    if (paidError) {
      return fail(paidError.message, 500);
    }

    const { data: recentLogs, error: logsError } = await supabaseAdmin
      .from("api_usage_logs")
      .select(
        "id, organisation_id, project_id, api_key_id, endpoint, method, status_code, duration_ms, request_source, channel, paid_channel, wallet_transaction_id, error_message, created_at, metadata"
      )
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (logsError) {
      return fail(logsError.message, 500);
    }

    const endpointCounts = new Map<string, number>();
    const channelCounts = new Map<string, number>();

    for (const row of recentLogs ?? []) {
      endpointCounts.set(
        row.endpoint,
        (endpointCounts.get(row.endpoint) ?? 0) + 1
      );

      const channel = row.channel ?? "none";
      channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
    }

    return ok({
      summary: {
        month_start: monthStart,
        total_requests_this_month: totalRequests ?? 0,
        failed_requests_this_month: failedRequests ?? 0,
        paid_channel_sends_this_month: paidChannelSends ?? 0,
      },
      breakdown: {
        recent_requests_by_endpoint: Array.from(endpointCounts.entries()).map(
          ([endpoint, count]) => ({ endpoint, count })
        ),
        recent_requests_by_channel: Array.from(channelCounts.entries()).map(
          ([channel, count]) => ({ channel, count })
        ),
      },
      recent_logs: recentLogs ?? [],
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load API usage.", 500);
  }
}