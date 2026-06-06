import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function calculateTrialDaysRemaining(trialEndsAt?: string | null) {
  if (!trialEndsAt) return 0;

  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();

  if (Number.isNaN(end)) return 0;

  const diff = end - now;

  if (diff <= 0) return 0;

  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function isTrialActive(subscription: any) {
  if (!subscription) return false;

  if (subscription.status !== "trial") return false;

  const trialEndsAt = subscription.trial_ends_at;

  if (!trialEndsAt) return false;

  return new Date(trialEndsAt).getTime() > Date.now();
}

function isSubscriptionActive(subscription: any) {
  if (!subscription) return false;

  if (subscription.status === "active") {
    if (!subscription.ends_at) return true;

    return new Date(subscription.ends_at).getTime() > Date.now();
  }

  return isTrialActive(subscription);
}

function canUsePaidChannel(params: {
  subscription: any;
  wallet: any;
  channel: "sms" | "voice" | "whatsapp";
}) {
  const { subscription, wallet, channel } = params;

  if (!isSubscriptionActive(subscription)) {
    return false;
  }

  if (!wallet || wallet.status !== "active") {
    return false;
  }

  const balance = Number(wallet.balance ?? 0);

  if (!Number.isFinite(balance) || balance <= 0) {
    return false;
  }

  if (channel === "sms") return Boolean(wallet.sms_enabled);
  if (channel === "voice") return Boolean(wallet.voice_enabled);
  if (channel === "whatsapp") return Boolean(wallet.whatsapp_enabled);

  return false;
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

async function getOrganisation(organisationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("id, name, slug, status")
    .eq("id", organisationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getLatestSubscription(organisationId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getWallet(organisationId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_wallets")
    .select("*")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getRecentPayments(organisationId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_payments")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getMonthlyProjectSpend(organisationId: string) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("project_id, amount, transaction_type, channel, projects(name)")
    .eq("organisation_id", organisationId)
    .eq("transaction_type", "debit")
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<
    string,
    {
      project_id: string | null;
      project_name: string;
      amount: number;
      sms: number;
      voice: number;
      whatsapp: number;
    }
  >();

  for (const row of data ?? []) {
    const projectId = row.project_id ?? "no-project";
    const projectName =
      (row as any).projects?.name ??
      (row.project_id ? "Unnamed project" : "No project");

    const current =
      grouped.get(projectId) ??
      {
        project_id: row.project_id ?? null,
        project_name: projectName,
        amount: 0,
        sms: 0,
        voice: 0,
        whatsapp: 0,
      };

    const amount = Number(row.amount ?? 0);

    current.amount += Number.isFinite(amount) ? amount : 0;

    if (row.channel === "sms") current.sms += Number.isFinite(amount) ? amount : 0;
    if (row.channel === "voice")
      current.voice += Number.isFinite(amount) ? amount : 0;
    if (row.channel === "whatsapp")
      current.whatsapp += Number.isFinite(amount) ? amount : 0;

    grouped.set(projectId, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const requestedOrganisationId = cleanText(
      url.searchParams.get("organisation_id")
    );

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return fail(userError.message, 401);
    }

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const email = cleanText(user.email).toLowerCase();

    const membership = await getActiveMembership({
      userId: user.id,
      email,
    });

    if (!membership?.organisation_id) {
      return ok({
        user: {
          id: user.id,
          email,
        },
        organisation: null,
        subscription: null,
        wallet: null,
        access: {
          platform_allowed: false,
          participant_app_allowed: false,
          app_messaging_allowed: false,
          sms_allowed: false,
          voice_allowed: false,
          whatsapp_allowed: false,
          reason: "No active organisation membership.",
        },
        payments: [],
        project_spend_this_month: [],
      });
    }

    const organisationId = requestedOrganisationId || membership.organisation_id;

    if (
      requestedOrganisationId &&
      requestedOrganisationId !== membership.organisation_id
    ) {
      return fail("You are not allowed to view billing for this organisation.", 403);
    }

    const organisation = await getOrganisation(organisationId);

    if (!organisation) {
      return fail("Organisation not found.", 404);
    }

    const subscription = await getLatestSubscription(organisationId);
    const wallet = await getWallet(organisationId);
    const payments = await getRecentPayments(organisationId);
    const projectSpend = await getMonthlyProjectSpend(organisationId);

    const subscriptionActive = isSubscriptionActive(subscription);
    const trialActive = isTrialActive(subscription);
    const trialDaysRemaining = calculateTrialDaysRemaining(
      subscription?.trial_ends_at
    );

    const smsAllowed = canUsePaidChannel({
      subscription,
      wallet,
      channel: "sms",
    });

    const voiceAllowed = canUsePaidChannel({
      subscription,
      wallet,
      channel: "voice",
    });

    const whatsappAllowed = canUsePaidChannel({
      subscription,
      wallet,
      channel: "whatsapp",
    });

    return ok({
      user: {
        id: user.id,
        email,
      },
      organisation: {
        id: organisation.id,
        name: organisation.name,
        slug: organisation.slug,
        status: organisation.status,
        role: membership.role,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            plan_name: subscription.plan_name,
            status: subscription.status,
            trial_starts_at: subscription.trial_starts_at,
            trial_ends_at: subscription.trial_ends_at,
            trial_days_remaining: trialDaysRemaining,
            starts_at: subscription.starts_at,
            ends_at: subscription.ends_at,
            is_trial_active: trialActive,
            is_subscription_active: subscriptionActive,
          }
        : null,
      wallet: wallet
        ? {
            id: wallet.id,
            status: wallet.status,
            currency: wallet.currency,
            balance: Number(wallet.balance ?? 0),
            sms_enabled: Boolean(wallet.sms_enabled),
            voice_enabled: Boolean(wallet.voice_enabled),
            whatsapp_enabled: Boolean(wallet.whatsapp_enabled),
          }
        : null,
      access: {
        platform_allowed: subscriptionActive,
        participant_app_allowed: subscriptionActive,
        app_messaging_allowed: subscriptionActive,
        sms_allowed: smsAllowed,
        voice_allowed: voiceAllowed,
        whatsapp_allowed: whatsappAllowed,
        paid_channels_require_wallet: true,
        reason: subscriptionActive
          ? wallet?.status === "active"
            ? "Subscription is active. Paid channels depend on wallet balance and channel enablement."
            : "Subscription/trial is active. Paid channels require an active funded wallet."
          : "No active subscription or trial.",
      },
      payments,
      project_spend_this_month: projectSpend,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load billing status.", 500);
  }
}