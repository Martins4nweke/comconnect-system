import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PaidChannel } from "@/lib/billing/guards";

type ChannelPriceResult = {
  channel: PaidChannel;
  currency: string;
  unit_price: number;
};

type DeductWalletParams = {
  organisationId: string;
  projectId?: string | null;
  walletId?: string | null;
  channel: PaidChannel;
  amount?: number | null;
  reference?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, any>;
};

export async function getActiveChannelPrice(
  channel: PaidChannel
): Promise<ChannelPriceResult> {
  const { data, error } = await supabaseAdmin
    .from("billing_channel_prices")
    .select("*")
    .eq("channel", channel)
    .eq("status", "active")
    .lte("effective_from", new Date().toISOString())
    .or(`effective_to.is.null,effective_to.gt.${new Date().toISOString()}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const fallback =
      channel === "whatsapp"
        ? 1.2
        : 1;

    return {
      channel,
      currency: "ZAR",
      unit_price: fallback,
    };
  }

  return {
    channel,
    currency: data.currency ?? "ZAR",
    unit_price: Number(data.unit_price ?? 0),
  };
}

export async function deductWalletBalance(params: DeductWalletParams) {
  const price = await getActiveChannelPrice(params.channel);

  const amount = Number(params.amount ?? price.unit_price ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Invalid wallet deduction amount.",
      wallet: null,
      transaction: null,
      amount: 0,
      currency: price.currency,
    };
  }

  const { data: wallet, error: walletError } = await supabaseAdmin
    .from("billing_wallets")
    .select("*")
    .eq("organisation_id", params.organisationId)
    .maybeSingle();

  if (walletError) {
    throw new Error(walletError.message);
  }

  if (!wallet || wallet.status !== "active") {
    return {
      ok: false,
      error: "Active wallet not found.",
      wallet: null,
      transaction: null,
      amount,
      currency: price.currency,
    };
  }

  const balanceBefore = Number(wallet.balance ?? 0);

  if (!Number.isFinite(balanceBefore) || balanceBefore < amount) {
    return {
      ok: false,
      error: "Wallet balance is not enough.",
      wallet,
      transaction: null,
      amount,
      currency: wallet.currency ?? price.currency,
    };
  }

  const balanceAfter = Number((balanceBefore - amount).toFixed(2));

  const { data: updatedWallet, error: updateError } = await supabaseAdmin
    .from("billing_wallets")
    .update({
      balance: balanceAfter,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(wallet.metadata ?? {}),
        last_debit_amount: amount,
        last_debit_channel: params.channel,
        last_debit_at: new Date().toISOString(),
      },
    })
    .eq("id", wallet.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from("wallet_transactions")
    .insert({
      organisation_id: params.organisationId,
      project_id: params.projectId ?? null,
      wallet_id: wallet.id,
      transaction_type: "debit",
      channel: params.channel,
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference: params.reference ?? null,
      created_by: params.createdBy ?? null,
      metadata: {
        ...(params.metadata ?? {}),
        channel_price: price.unit_price,
        channel_price_currency: price.currency,
      },
    })
    .select("*")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  return {
    ok: true,
    error: null,
    wallet: updatedWallet,
    transaction,
    amount,
    currency: wallet.currency ?? price.currency,
  };
}