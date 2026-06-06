import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BILLING_ADMIN_ROLES = new Set([
  "platform_owner",
  "superadmin",
  "organisation_admin",
  "org_admin",
  "admin",
]);

const ALLOWED_PAYMENT_TYPES = new Set([
  "subscription",
  "wallet_topup",
  "subscription_and_wallet",
]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isBillingAdmin(role?: string | null) {
  return BILLING_ADMIN_ROLES.has(cleanText(role).toLowerCase());
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
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

async function ensureReceiptBucket() {
  const bucketName = "billing-receipts";

  const { data: buckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName);

  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      bucketName,
      {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ],
      }
    );

    if (createError) {
      throw new Error(createError.message);
    }
  }

  return bucketName;
}

async function uploadReceipt(params: {
  organisationId: string;
  paymentId: string;
  file: File;
}) {
  const bucketName = await ensureReceiptBucket();

  const originalName = params.file.name || "receipt";
  const fileName = safeFileName(originalName);
  const filePath = `${params.organisationId}/${params.paymentId}/${Date.now()}-${fileName}`;

  const arrayBuffer = await params.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    bucket: bucketName,
    path: filePath,
    name: originalName,
  };
}

export async function POST(req: NextRequest) {
  try {
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
      return fail("No active organisation membership found.", 403);
    }

    if (!isBillingAdmin(membership.role)) {
      return fail("Only organisation admins can submit billing receipts.", 403);
    }

    const formData = await req.formData();

    const paymentType = cleanText(formData.get("payment_type"));
    const planName = cleanText(formData.get("plan_name"));
    const amountText = cleanText(formData.get("amount"));
    const currency = cleanText(formData.get("currency")) || "ZAR";
    const paymentReference = cleanText(formData.get("payment_reference"));
    const paymentDate = cleanText(formData.get("payment_date"));
    const notes = cleanText(formData.get("notes"));
    const receipt = formData.get("receipt");

    if (!ALLOWED_PAYMENT_TYPES.has(paymentType)) {
      return fail(
        "Payment type must be subscription, wallet_topup, or subscription_and_wallet.",
        400
      );
    }

    const amount = Number(amountText);

    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Enter a valid payment amount.", 400);
    }

    if (!(receipt instanceof File) || receipt.size <= 0) {
      return fail("Upload a payment receipt file.", 400);
    }

    if (receipt.size > 10 * 1024 * 1024) {
      return fail("Receipt file is too large. Maximum size is 10MB.", 400);
    }

    const allowedTypes = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]);

    if (receipt.type && !allowedTypes.has(receipt.type)) {
      return fail("Receipt must be PDF, PNG, JPG, JPEG, or WEBP.", 400);
    }

    /*
      First create the billing payment row, then upload the receipt using
      the payment id as part of the file path, then update the row.
    */
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("billing_payments")
      .insert({
        organisation_id: membership.organisation_id,
        uploaded_by: user.id,
        payment_type: paymentType,
        plan_name: planName || null,
        amount,
        currency,
        receipt_url: null,
        receipt_name: receipt.name || "receipt",
        payment_reference: paymentReference || null,
        payment_date: paymentDate || null,
        status: "submitted",
        metadata: {
          notes: notes || null,
          uploaded_by_email: email,
          uploaded_from: "billing_page",
        },
      })
      .select("*")
      .single();

    if (paymentError) {
      return fail(paymentError.message, 500);
    }

    const uploadedReceipt = await uploadReceipt({
      organisationId: membership.organisation_id,
      paymentId: payment.id,
      file: receipt,
    });

    const receiptUrl = `${uploadedReceipt.bucket}/${uploadedReceipt.path}`;

    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from("billing_payments")
      .update({
        receipt_url: receiptUrl,
        receipt_name: uploadedReceipt.name,
        metadata: {
          ...(payment.metadata ?? {}),
          receipt_bucket: uploadedReceipt.bucket,
          receipt_path: uploadedReceipt.path,
          receipt_content_type: receipt.type || null,
          receipt_size: receipt.size,
        },
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (updateError) {
      return fail(updateError.message, 500);
    }

    return ok(
      {
        payment: updatedPayment,
        message:
          "Receipt submitted. A superadmin will review and activate the subscription or wallet if payment is approved.",
      },
      201
    );
  } catch (error: any) {
    return fail(error?.message ?? "Failed to submit billing receipt.", 500);
  }
}