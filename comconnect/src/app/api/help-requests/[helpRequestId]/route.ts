import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ helpRequestId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { helpRequestId } = await params;

  const { data, error } = await supabaseAdmin
    .from("help_requests")
    .select("*")
    .eq("id", helpRequestId)
    .single();

  if (error) return fail("Help request not found", 404);
  return ok(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { helpRequestId } = await params;
  const body = await req.json().catch(() => null);

  const { data, error } = await supabaseAdmin
    .from("help_requests")
    .update({
      status: body?.status,
      assigned_user_id: body?.assigned_user_id,
      priority: body?.priority,
      category: body?.category,
      message: body?.message,
      metadata: body?.metadata,
    })
    .eq("id", helpRequestId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "help_request.updated",
    entity_type: "help_request",
    entity_id: data.id,
    metadata: { status: data.status, priority: data.priority },
  });

  return ok(data);
}
