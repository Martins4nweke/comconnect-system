import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function safeLimit(value: string | null) {
  const parsed = Number(value ?? 100);

  if (!Number.isFinite(parsed)) return 100;

  return Math.min(Math.max(parsed, 1), 200);
}

async function getProject(projectId: string | null) {
  if (!projectId) return null;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .eq("id", projectId)
    .single();

  if (error || !data) return null;

  return data;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const mediaType = req.nextUrl.searchParams.get("media_type");
  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q");
  const limit = safeLimit(req.nextUrl.searchParams.get("limit"));

  let query = supabaseAdmin
    .from("media_assets")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);
  if (mediaType) query = query.eq("media_type", mediaType);
  if (status) query = query.eq("status", status);

  if (q) {
    const search = cleanText(q);
    query = query.or(
      `title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%,language_code.ilike.%${search}%,file_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const id = cleanText(body?.id);
  const action = cleanText(body?.action || "archive");

  if (!id) return fail("Media asset id is required", 400);

  if (action !== "archive" && action !== "restore" && action !== "approve") {
    return fail("Unsupported media action", 400);
  }

  if (action === "approve") {
    const { data, error } = await supabaseAdmin
      .from("media_assets")
      .update({
        is_approved: true,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id ?? null,
      project_id: data.project_id ?? null,
      actor_type: "dashboard_user",
      action: "media_asset.approved",
      entity_type: "media_asset",
      entity_id: data.id,
      metadata: {
        title: data.title,
        media_type: data.media_type,
        public_url: data.public_url,
      },
    });

    return ok(data);
  }

  const shouldArchive = action === "archive";

  const { data, error } = await supabaseAdmin
    .from("media_assets")
    .update({
      is_deleted: shouldArchive,
      deleted_at: shouldArchive ? new Date().toISOString() : null,
      status: shouldArchive ? "archived" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id ?? null,
    project_id: data.project_id ?? null,
    actor_type: "dashboard_user",
    action: shouldArchive ? "media_asset.archived" : "media_asset.restored",
    entity_type: "media_asset",
    entity_id: data.id,
    metadata: {
      title: data.title,
      media_type: data.media_type,
      public_url: data.public_url,
    },
  });

  return ok(data);
}