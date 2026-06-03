import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ inboxItemId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { inboxItemId } = await params;

  const { data, error } = await supabaseAdmin
    .from("inbox_items")
    .select("*")
    .eq("id", inboxItemId)
    .single();

  if (error) return fail("Inbox item not found", 404);
  return ok(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { inboxItemId } = await params;
  const body = await req.json().catch(() => null);

  const { data, error } = await supabaseAdmin
    .from("inbox_items")
    .update({
      status: body?.status,
      assigned_user_id: body?.assigned_user_id,
      priority: body?.priority,
      title: body?.title,
      summary: body?.summary,
    })
    .eq("id", inboxItemId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "inbox_item.updated",
    entity_type: "inbox_item",
    entity_id: data.id,
    metadata: { status: data.status, priority: data.priority },
  });

  return ok(data);
}
