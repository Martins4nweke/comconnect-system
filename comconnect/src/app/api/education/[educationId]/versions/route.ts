import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ educationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { educationId } = await params;

  const { data, error } = await supabaseAdmin
    .from("education_versions")
    .select("*")
    .eq("education_item_id", educationId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { educationId } = await params;
  const body = await req.json().catch(() => null);

  const { data: item, error: itemError } = await supabaseAdmin
    .from("education_items")
    .select("id, organisation_id, project_id")
    .eq("id", educationId)
    .single();

  if (itemError || !item) return fail("Education item not found", 404);

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
      published_at: body?.status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  if (data.status === "published") {
    await supabaseAdmin
      .from("education_items")
      .update({
        current_version_id: data.id,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", item.id);
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
}
