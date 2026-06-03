import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

const STORAGE_BUCKET = "upload-templates";

const allowedTemplateTypes = ["participants", "messages", "schedules"];

function isSuperadmin(req: NextRequest) {
  const expectedKey = process.env.TEMPLATE_SUPERADMIN_KEY;
  const providedKey = req.headers.get("x-template-admin-key");

  if (!expectedKey) return false;
  return providedKey === expectedKey;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "bin" : "bin";
}

function fileTypeAllowed(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv")
  ) {
    return true;
  }

  return (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType === "text/csv" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export async function POST(req: NextRequest) {
  if (!isSuperadmin(req)) {
    return fail("Only superadmin can upload templates.", 403);
  }

  const formData = await req.formData().catch(() => null);

  if (!formData) return fail("Invalid upload request.", 400);

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return fail("Template file is required.", 400);
  }

  const templateType = cleanText(formData.get("template_type"));
  const title = cleanText(formData.get("title"));
  const description = cleanText(formData.get("description"));
  const version = cleanText(formData.get("version")) || "1.0";

  if (!allowedTemplateTypes.includes(templateType)) {
    return fail("Invalid template type.", 400);
  }

  if (!title) {
    return fail("Template title is required.", 400);
  }

  if (!fileTypeAllowed(file.name, file.type || "")) {
    return fail("Only CSV, XLS or XLSX template files are allowed.", 400);
  }

  const extension = getFileExtension(file.name);
  const safeTitle = sanitizeFileName(title);
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const filePath = `${templateType}/${safeTitle}-v${version}-${randomPart}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const uploadResult = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadResult.error) {
    return fail(
      `${uploadResult.error.message}. Confirm the storage bucket "${STORAGE_BUCKET}" exists and is public.`,
      500
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  await supabaseAdmin
    .from("upload_templates")
    .update({
      is_active: false,
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("template_type", templateType)
    .eq("is_active", true);

  const { data, error } = await supabaseAdmin
    .from("upload_templates")
    .insert({
      template_type: templateType,
      title,
      description: description || null,
      version,
      file_name: file.name,
      file_path: filePath,
      public_url: publicUrl,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      status: "active",
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok(data, 201);
}