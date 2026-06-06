import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPERADMIN_ROLES = new Set(["platform_owner", "superadmin"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isSuperadmin(role?: string | null) {
  return SUPERADMIN_ROLES.has(cleanText(role).toLowerCase());
}

function trialDaysRemaining(trialEndsAt?: string | null) {
  if (!trialEndsAt) return 0;

  const end = new Date(trialEndsAt).getTime();

  if (Number.isNaN(end)) return 0;

  const diff = end - Date.now();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (24 * 60 * 60 * 1000));
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

async function getSuperadminMembership(params: {
  userId: string;
  email: string;
}) {
  const { data: byUserId, error: byUserIdError } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .in("role", Array.from(SUPERADMIN_ROLES))
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
    .in("role", Array.from(SUPERADMIN_ROLES))
    .limit(1)
    .maybeSingle();

  if (byEmailError) {
    throw new Error(byEmailError.message);
  }

  return byEmail;
}

async function requireSuperadmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Not authenticated.",
      status: 401,
      user: null,
    };
  }

  const email = cleanText(user.email).toLowerCase();

  const membership = await getSuperadminMembership({
    userId: user.id,
    email,
  });

  if (!membership || !isSuperadmin(membership.role)) {
    return {
      ok: false as const,
      error: "Only superadmin can review billing receipts.",
      status: 403,
      user,
    };
  }

  return {
    ok: true as const,
    user,
    membership,
  };
}

async function getPayment(paymentId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_payments")
    .select("*")
    .eq("id", paymentId)
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

async function activateSubscription(params: {
  organisationId: string;
  planName?: string | null;
  reviewedBy: string;
  paymentId: string;
}) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const latest = await getLatestSubscription(params.organisationId);

  if (latest?.id) {
    const { data, error } = await supabaseAdmin
      .from("billing_subscriptions")
      .update({
        plan_name: params.planName || latest.plan_name || "Research",
        status: "active",
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        activated_by: params.reviewedBy,
        activated_at: now.toISOString(),
        metadata: {
          ...(latest.metadata ?? {}),
          activated_from_payment_id: params.paymentId,
          billing_period_days: 30,
          access_scope: "comconnect_and_participant_app",
          paid_channels_included: false,
          paid_channels_require_wallet: true,
        },
      })
      .eq("id", latest.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .insert({
      organisation_id: params.organisationId,
      plan_name: params.planName || "Research",
      status: "active",
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      activated_by: params.reviewedBy,
      activated_at: now.toISOString(),
      metadata: {
        activated_from_payment_id: params.paymentId,
        billing_period_days: 30,
        access_scope: "comconnect_and_participant_app",
        paid_channels_included: false,
        paid_channels_require_wallet: true,
      },
    })
    .select("*")
    .single();

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

async function activateOrTopupWallet(params: {
  organisationId: string;
  amount: number;
  reviewedBy: string;
  paymentId: string;
  enableSms: boolean;
  enableVoice: boolean;
  enableWhatsapp: boolean;
}) {
  const wallet = await getWallet(params.organisationId);

  if (wallet?.id) {
    const balanceBefore = Number(wallet.balance ?? 0);
    const balanceAfter = balanceBefore + params.amount;

    const { data: updatedWallet, error: walletError } = await supabaseAdmin
      .from("billing_wallets")
      .update({
        status: "active",
        balance: balanceAfter,
        sms_enabled: params.enableSms,
        voice_enabled: params.enableVoice,
        whatsapp_enabled: params.enableWhatsapp,
        metadata: {
          ...(wallet.metadata ?? {}),
          last_topup_payment_id: params.paymentId,
          last_topup_amount: params.amount,
          last_topup_at: new Date().toISOString(),
        },
      })
      .eq("id", wallet.id)
      .select("*")
      .single();

    if (walletError) {
      throw new Error(walletError.message);
    }

    const { error: txError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        organisation_id: params.organisationId,
        wallet_id: wallet.id,
        transaction_type: "topup",
        channel: "manual",
        amount: params.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference: params.paymentId,
        created_by: params.reviewedBy,
        metadata: {
          payment_id: params.paymentId,
          source: "superadmin_payment_approval",
        },
      });

    if (txError) {
      throw new Error(txError.message);
    }

    return updatedWallet;
  }

  const { data: createdWallet, error: createError } = await supabaseAdmin
    .from("billing_wallets")
    .insert({
      organisation_id: params.organisationId,
      status: "active",
      currency: "ZAR",
      balance: params.amount,
      sms_enabled: params.enableSms,
      voice_enabled: params.enableVoice,
      whatsapp_enabled: params.enableWhatsapp,
      metadata: {
        created_from: "superadmin_payment_approval",
        first_topup_payment_id: params.paymentId,
      },
    })
    .select("*")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const { error: txError } = await supabaseAdmin
    .from("wallet_transactions")
    .insert({
      organisation_id: params.organisationId,
      wallet_id: createdWallet.id,
      transaction_type: "topup",
      channel: "manual",
      amount: params.amount,
      balance_before: 0,
      balance_after: params.amount,
      reference: params.paymentId,
      created_by: params.reviewedBy,
      metadata: {
        payment_id: params.paymentId,
        source: "superadmin_payment_approval",
      },
    });

  if (txError) {
    throw new Error(txError.message);
  }

  return createdWallet;
}

async function getOrganisationBillingOverview() {
  const { data: organisations, error: orgError } = await supabaseAdmin
    .from("organisations")
    .select("id, name, slug, status, created_at")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(500);

  if (orgError) {
    throw new Error(orgError.message);
  }

  const organisationIds = (organisations ?? []).map((org) => org.id);

  if (organisationIds.length === 0) {
    return [];
  }

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("*")
    .in("organisation_id", organisationIds)
    .order("created_at", { ascending: false });

  if (subError) {
    throw new Error(subError.message);
  }

  const { data: wallets, error: walletError } = await supabaseAdmin
    .from("billing_wallets")
    .select("*")
    .in("organisation_id", organisationIds);

  if (walletError) {
    throw new Error(walletError.message);
  }

  const { data: pendingPayments, error: pendingError } = await supabaseAdmin
    .from("billing_payments")
    .select("organisation_id, status")
    .in("organisation_id", organisationIds)
    .eq("status", "submitted");

  if (pendingError) {
    throw new Error(pendingError.message);
  }

  const latestSubscriptionByOrg = new Map<string, any>();
  const walletByOrg = new Map<string, any>();
  const pendingCountByOrg = new Map<string, number>();

  for (const subscription of subscriptions ?? []) {
    if (!latestSubscriptionByOrg.has(subscription.organisation_id)) {
      latestSubscriptionByOrg.set(subscription.organisation_id, subscription);
    }
  }

  for (const wallet of wallets ?? []) {
    walletByOrg.set(wallet.organisation_id, wallet);
  }

  for (const payment of pendingPayments ?? []) {
    const current = pendingCountByOrg.get(payment.organisation_id) ?? 0;
    pendingCountByOrg.set(payment.organisation_id, current + 1);
  }

  return (organisations ?? []).map((organisation) => {
    const subscription = latestSubscriptionByOrg.get(organisation.id) ?? null;
    const wallet = walletByOrg.get(organisation.id) ?? null;

    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status,
      created_at: organisation.created_at,

      plan_name: subscription?.plan_name ?? "No plan",
      subscription_status: subscription?.status ?? "none",
      trial_starts_at: subscription?.trial_starts_at ?? null,
      trial_ends_at: subscription?.trial_ends_at ?? null,
      trial_days_remaining: trialDaysRemaining(subscription?.trial_ends_at),
      starts_at: subscription?.starts_at ?? null,
      ends_at: subscription?.ends_at ?? null,

      wallet_status: wallet?.status ?? "none",
      wallet_currency: wallet?.currency ?? "ZAR",
      wallet_balance: Number(wallet?.balance ?? 0),
      sms_enabled: Boolean(wallet?.sms_enabled),
      voice_enabled: Boolean(wallet?.voice_enabled),
      whatsapp_enabled: Boolean(wallet?.whatsapp_enabled),

      pending_payments: pendingCountByOrg.get(organisation.id) ?? 0,
    };
  });
}

export async function GET() {
  try {
    const auth = await requireSuperadmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const [organisations, paymentsResult] = await Promise.all([
      getOrganisationBillingOverview(),
      supabaseAdmin
        .from("billing_payments")
        .select("*, organisations(name, slug)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (paymentsResult.error) {
      return fail(paymentsResult.error.message, 500);
    }

    return ok({
      organisations,
      payments: paymentsResult.data ?? [],
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load billing payments.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireSuperadmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const paymentId = cleanText(body?.payment_id);
    const action = cleanText(body?.action).toLowerCase();
    const reviewNotes = cleanText(body?.review_notes);
    const enableSms = Boolean(body?.enable_sms);
    const enableVoice = Boolean(body?.enable_voice);
    const enableWhatsapp = Boolean(body?.enable_whatsapp);

    if (!paymentId) {
      return fail("payment_id is required.", 400);
    }

    if (!["approve", "reject"].includes(action)) {
      return fail("action must be approve or reject.", 400);
    }

    const payment = await getPayment(paymentId);

    if (!payment) {
      return fail("Payment not found.", 404);
    }

    if (payment.status !== "submitted") {
      return fail("Only submitted payments can be reviewed.", 400);
    }

    if (action === "reject") {
      const { data, error } = await supabaseAdmin
        .from("billing_payments")
        .update({
          status: "rejected",
          reviewed_by: auth.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || "Rejected by superadmin.",
        })
        .eq("id", paymentId)
        .select("*")
        .single();

      if (error) {
        return fail(error.message, 500);
      }

      return ok({
        payment: data,
        message: "Payment rejected.",
      });
    }

    const amount = Number(payment.amount ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Payment amount is invalid.", 400);
    }

    const paymentType = payment.payment_type;

    let subscription = null;
    let wallet = null;

    if (
      paymentType === "subscription" ||
      paymentType === "subscription_and_wallet"
    ) {
      subscription = await activateSubscription({
        organisationId: payment.organisation_id,
        planName: payment.plan_name,
        reviewedBy: auth.user.id,
        paymentId: payment.id,
      });
    }

    if (
      paymentType === "wallet_topup" ||
      paymentType === "subscription_and_wallet"
    ) {
      wallet = await activateOrTopupWallet({
        organisationId: payment.organisation_id,
        amount,
        reviewedBy: auth.user.id,
        paymentId: payment.id,
        enableSms,
        enableVoice,
        enableWhatsapp,
      });
    }

    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from("billing_payments")
      .update({
        status: "approved",
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || "Approved by superadmin.",
        metadata: {
          ...(payment.metadata ?? {}),
          approved_action: action,
          enable_sms: enableSms,
          enable_voice: enableVoice,
          enable_whatsapp: enableWhatsapp,
        },
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (updateError) {
      return fail(updateError.message, 500);
    }

    return ok({
      payment: updatedPayment,
      subscription,
      wallet,
      message: "Payment approved and billing status updated.",
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to review billing payment.", 500);
  }
}