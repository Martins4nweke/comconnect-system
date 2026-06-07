import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPERADMIN_ROLES = new Set(["platform_owner", "superadmin"]);

const ALLOWED_CHANNELS = new Set(["sms", "voice", "whatsapp"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isSuperadmin(role?: string | null) {
  return SUPERADMIN_ROLES.has(cleanText(role).toLowerCase());
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
      status: 401,
      error: "Not authenticated.",
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
      status: 403,
      error: "Only superadmin can manage billing settings.",
      user,
    };
  }

  return {
    ok: true as const,
    user,
    membership,
  };
}

async function getActivePrices() {
  const { data, error } = await supabaseAdmin
    .from("billing_channel_prices")
    .select("*")
    .eq("status", "active")
    .order("channel", { ascending: true })
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latestByChannel = new Map<string, any>();

  for (const row of data ?? []) {
    if (!latestByChannel.has(row.channel)) {
      latestByChannel.set(row.channel, row);
    }
  }

  return ["sms", "voice", "whatsapp"].map((channel) => {
    const row = latestByChannel.get(channel);

    return (
      row ?? {
        id: null,
        channel,
        currency: "ZAR",
        unit_price: channel === "whatsapp" ? 1.2 : 1,
        status: "active",
        effective_from: null,
        effective_to: null,
        metadata: {
          fallback: true,
        },
      }
    );
  });
}

export async function GET() {
  try {
    const auth = await requireSuperadmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const prices = await getActivePrices();

    return ok({
      prices,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load channel prices.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireSuperadmin();

    if (!auth.ok) {
      return fail(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);

    const channel = cleanText(body?.channel).toLowerCase();
    const currency = cleanText(body?.currency || "ZAR").toUpperCase();
    const unitPrice = Number(body?.unit_price);

    if (!ALLOWED_CHANNELS.has(channel)) {
      return fail("Channel must be sms, voice or whatsapp.", 400);
    }

    if (!currency || currency.length > 10) {
      return fail("Currency is required.", 400);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return fail("Enter a valid unit price.", 400);
    }

    const now = new Date().toISOString();

    /*
      Archive existing active price for the channel, then insert a new active
      price row. This preserves price history.
    */
    const { error: archiveError } = await supabaseAdmin
      .from("billing_channel_prices")
      .update({
        status: "archived",
        effective_to: now,
        updated_at: now,
      })
      .eq("channel", channel)
      .eq("status", "active");

    if (archiveError) {
      return fail(archiveError.message, 500);
    }

    const { data: price, error: insertError } = await supabaseAdmin
      .from("billing_channel_prices")
      .insert({
        channel,
        currency,
        unit_price: unitPrice,
        status: "active",
        effective_from: now,
        effective_to: null,
        metadata: {
          updated_by: auth.user.id,
          updated_by_email: auth.user.email ?? null,
          source: "admin_billing_settings",
        },
      })
      .select("*")
      .single();

    if (insertError) {
      return fail(insertError.message, 500);
    }

    return ok({
      price,
      message: `${channel.toUpperCase()} price updated.`,
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to update channel price.", 500);
  }
}