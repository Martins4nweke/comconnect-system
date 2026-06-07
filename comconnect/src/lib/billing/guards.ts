import { supabaseAdmin } from "@/lib/supabase/admin";

export type PaidChannel = "sms" | "voice" | "whatsapp";

export type BillingGuardReason =
  | "allowed"
  | "missing_organisation"
  | "no_subscription"
  | "subscription_inactive"
  | "wallet_inactive"
  | "wallet_empty"
  | "channel_disabled";

export type BillingGuardResult = {
  ok: boolean;
  status: number;
  error: string;
  reason: BillingGuardReason;
  organisation_id?: string;
  subscription?: any;
  wallet?: any;
  balance: number;
};

function isTrialActive(subscription: any) {
  if (!subscription) return false;
  if (subscription.status !== "trial") return false;
  if (!subscription.trial_ends_at) return false;

  return new Date(subscription.trial_ends_at).getTime() > Date.now();
}

function isSubscriptionActive(subscription: any) {
  if (!subscription) return false;

  if (subscription.status === "active") {
    if (!subscription.ends_at) return true;
    return new Date(subscription.ends_at).getTime() > Date.now();
  }

  return isTrialActive(subscription);
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

export async function requirePlatformAccess(
  organisationId?: string | null
): Promise<BillingGuardResult> {
  if (!organisationId) {
    return {
      ok: false,
      status: 400,
      error: "Organisation is required.",
      reason: "missing_organisation",
      balance: 0,
    };
  }

  const subscription = await getLatestSubscription(organisationId);
  const wallet = await getWallet(organisationId);
  const balance = Number(wallet?.balance ?? 0);

  if (!subscription) {
    return {
      ok: false,
      status: 402,
      error:
        "No active trial or subscription found. Please upload payment receipt or contact support.",
      reason: "no_subscription",
      organisation_id: organisationId,
      subscription,
      wallet,
      balance,
    };
  }

  if (!isSubscriptionActive(subscription)) {
    return {
      ok: false,
      status: 402,
      error:
        "Your trial or subscription is not active. Please renew your subscription to continue using ComConnect.",
      reason: "subscription_inactive",
      organisation_id: organisationId,
      subscription,
      wallet,
      balance,
    };
  }

  return {
    ok: true,
    status: 200,
    error: "",
    reason: "allowed",
    organisation_id: organisationId,
    subscription,
    wallet,
    balance,
  };
}

export async function requirePaidChannelAccess(params: {
  organisationId?: string | null;
  channel: PaidChannel;
  estimatedCost?: number;
}): Promise<BillingGuardResult> {
  const platform = await requirePlatformAccess(params.organisationId);

  if (!platform.ok) {
    return platform;
  }

  const wallet = platform.wallet;

  if (!wallet || wallet.status !== "active") {
    return {
      ok: false,
      status: 402,
      error:
        "SMS, voice calls and WhatsApp require an active funded wallet. Your subscription only covers ComConnect and the Participant app.",
      reason: "wallet_inactive",
      organisation_id: platform.organisation_id,
      subscription: platform.subscription,
      wallet,
      balance: Number(wallet?.balance ?? 0),
    };
  }

  const balance = Number(wallet.balance ?? 0);
  const estimatedCost = Number(params.estimatedCost ?? 0);

  if (!Number.isFinite(balance) || balance <= 0) {
    return {
      ok: false,
      status: 402,
      error:
        "Wallet balance is empty. Please top up your wallet before using SMS, voice calls or WhatsApp.",
      reason: "wallet_empty",
      organisation_id: platform.organisation_id,
      subscription: platform.subscription,
      wallet,
      balance: 0,
    };
  }

  if (estimatedCost > 0 && balance < estimatedCost) {
    return {
      ok: false,
      status: 402,
      error:
        "Wallet balance is not enough for this paid-channel action. Please top up your wallet.",
      reason: "wallet_empty",
      organisation_id: platform.organisation_id,
      subscription: platform.subscription,
      wallet,
      balance,
    };
  }

  const channelEnabled =
    params.channel === "sms"
      ? Boolean(wallet.sms_enabled)
      : params.channel === "voice"
        ? Boolean(wallet.voice_enabled)
        : Boolean(wallet.whatsapp_enabled);

  if (!channelEnabled) {
    return {
      ok: false,
      status: 403,
      error: `${params.channel.toUpperCase()} is not enabled for this organisation. Please contact support or submit a wallet top-up receipt for approval.`,
      reason: "channel_disabled",
      organisation_id: platform.organisation_id,
      subscription: platform.subscription,
      wallet,
      balance,
    };
  }

  return {
    ok: true,
    status: 200,
    error: "",
    reason: "allowed",
    organisation_id: platform.organisation_id,
    subscription: platform.subscription,
    wallet,
    balance,
  };
}