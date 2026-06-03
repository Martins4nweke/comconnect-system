import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ educationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { educationId } = await params;

  const { data, error } = await supabaseAdmin
    .from("education_items")
    .select("*, education_versions(*), education_assignments(*)")
    .eq("id", educationId)
    .single();

  if (error) return fail("Education item not found", 404);
  return ok(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { educationId } = await params;
  const body = await req.json().catch(() => null);

  const { data, error } = await supabaseAdmin
    .from("education_items")
    .update({
      title: body?.title,
      description: body?.description,
      category: body?.category,
      language: body?.language,
      status: body?.status,
      text_content: body?.text_content,
      settings: body?.settings,
      metadata: body?.metadata,
      published_at: body?.status === "published" ? new Date().toISOString() : body?.published_at,
    })
    .eq("id", educationId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "education_item.updated",
    entity_type: "education_item",
    entity_id: data.id,
    metadata: { title: data.title },
  });

  return ok(data);
}
