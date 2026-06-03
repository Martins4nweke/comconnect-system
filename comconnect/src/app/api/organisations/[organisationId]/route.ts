import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ organisationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { organisationId } = await params;

  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("*")
    .eq("id", organisationId)
    .single();

  if (error || !data) return fail("Organisation not found", 404);
  return ok(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { organisationId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("Request body is required");

  const allowed = [
    "name",
    "slug",
    "logo_url",
    "primary_colour",
    "support_email",
    "support_phone",
    "status",
    "settings",
  ];

  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("organisations")
    .update(payload)
    .eq("id", organisationId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.id,
    actor_type: "dashboard_user",
    action: "organisation.updated",
    entity_type: "organisation",
    entity_id: data.id,
    metadata: payload,
  });

  return ok(data);
}
