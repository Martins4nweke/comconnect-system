import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

const STORAGE_BUCKET = "media-assets";

const allowedMediaTypes = ["audio", "video", "image", "document", "other"];

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseMediaType(value: unknown) {
  const text = cleanText(value).toLowerCase();

  if (allowedMediaTypes.includes(text)) return text;

  return "other";
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

function mimeLooksValid(mediaType: string, mimeType: string) {
  if (!mimeType) return true;

  if (mediaType === "audio") return mimeType.startsWith("audio/");
  if (mediaType === "video") return mimeType.startsWith("video/");
  if (mediaType === "image") return mimeType.startsWith("image/");

  if (mediaType === "document") {
    return (
      mimeType === "application/pdf" ||
      mimeType.includes("word") ||
      mimeType.includes("excel") ||
      mimeType.includes("spreadsheet") ||
      mimeType === "text/plain"
    );
  }

  return true;
}

async function resolveProject(projectId: string) {
  if (!projectId) return null;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .eq("id", projectId)
    .single();

  if (error || !data) return null;

  return data;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);

  if (!formData) return fail("Invalid upload request", 400);

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return fail("File is required", 400);
  }

  const title = cleanText(formData.get("title"));
  const description = cleanText(formData.get("description"));
  const category = cleanText(formData.get("category"));
  const languageCode = cleanText(formData.get("language_code")) || "en";
  const projectId = cleanText(formData.get("project_id"));
  const mediaType = normaliseMediaType(formData.get("media_type"));
  const isApproved = cleanText(formData.get("is_approved")).toLowerCase() === "true";

  if (!title) return fail("Media title is required", 400);

  if (!mimeLooksValid(mediaType, file.type)) {
    return fail(`Selected file does not match media type: ${mediaType}`, 400);
  }

  const project = await resolveProject(projectId);

  const extension = getFileExtension(file.name);
  const safeTitle = sanitizeFileName(title || file.name);
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const folder = project?.id ?? "general";
  const filePath = `${folder}/${mediaType}/${safeTitle}-${randomPart}.${extension}`;

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
      `${uploadResult.error.message}. Confirm the Supabase Storage bucket "${STORAGE_BUCKET}" exists and is public.`,
      500
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  const payload = {
    organisation_id: project?.organisation_id ?? null,
    project_id: project?.id ?? null,

    title,
    media_type: mediaType,
    language_code: languageCode,
    category: category || null,
    description: description || null,

    file_name: file.name,
    file_path: filePath,
    public_url: publicUrl,
    mime_type: file.type || null,
    file_size_bytes: file.size,

    is_approved: isApproved,
    status: "active",

    metadata: {
      uploaded_from: "media_library_page",
      storage_bucket: STORAGE_BUCKET,
    },

    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("media_assets")
    .insert(payload)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id ?? null,
    project_id: data.project_id ?? null,
    actor_type: "dashboard_user",
    action: "media_asset.uploaded",
    entity_type: "media_asset",
    entity_id: data.id,
    metadata: {
      title: data.title,
      media_type: data.media_type,
      file_name: data.file_name,
      file_size_bytes: data.file_size_bytes,
      public_url: data.public_url,
    },
  });

  return ok(data, 201);
}