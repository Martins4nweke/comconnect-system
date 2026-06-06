import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ educationId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageEducation(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

function applyEducationScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

async function getScopedEducationItem(
  educationId: string,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  let itemQuery = supabaseAdmin
    .from("education_items")
    .select("id, organisation_id, project_id")
    .eq("id", educationId);

  itemQuery = applyEducationScope(itemQuery, context);

  const { data, error } = await itemQuery.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { educationId } = await params;

    const item = await getScopedEducationItem(educationId, context);

    if (!item) {
      return fail("Education item not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("education_versions")
      .select("*")
      .eq("organisation_id", item.organisation_id)
      .eq("project_id", item.project_id)
      .eq("education_item_id", item.id)
      .order("created_at", { ascending: false });

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load education versions", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageEducation(context)) {
      return fail("You do not have permission to manage education versions.", 403);
    }

    const { educationId } = await params;
    const body = await req.json().catch(() => null);

    const item = await getScopedEducationItem(educationId, context);

    if (!item) {
      return fail("Education item not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("education_versions")
      .insert({
        organisation_id: item.organisation_id,
        project_id: item.project_id,
        education_item_id: item.id,
        version_label: body?.version_label ?? "v1.0",
        text_content: body?.text_content ?? null,
        video_low_url: body?.video_low_url ?? null,
        video_hd_url: body?.video_hd_url ?? null,
        audio_url: body?.audio_url ?? null,
        thumbnail_url: body?.thumbnail_url ?? null,
        transcript: body?.transcript ?? null,
        estimated_data_mb: body?.estimated_data_mb ?? null,
        status: body?.status ?? "draft",
        published_at:
          body?.status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    if (data.status === "published") {
      const { error: updateError } = await supabaseAdmin
        .from("education_items")
        .update({
          current_version_id: data.id,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("organisation_id", item.organisation_id)
        .eq("project_id", item.project_id)
        .eq("id", item.id);

      if (updateError) return fail(updateError.message, 500);
    }

    await createAuditLog({
      organisation_id: item.organisation_id,
      project_id: item.project_id,
      actor_type: "dashboard_user",
      action: "education_version.created",
      entity_type: "education_item",
      entity_id: item.id,
      metadata: {
        education_version_id: data.id,
        version_label: data.version_label,
        status: data.status,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create education version", 500);
  }
}