import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const organisationId = req.nextUrl.searchParams.get("organisation_id");
  if (!organisationId) return fail("organisation_id is required");

  const { data, error } = await supabaseAdmin
    .from("organisation_members")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organisation_id) return fail("organisation_id is required");
  if (!body?.email) return fail("email is required");

  const payload = {
    organisation_id: body.organisation_id,
    user_id: body.user_id ?? null,
    email: String(body.email).trim().toLowerCase(),
    full_name: body.full_name ?? null,
    role: body.role ?? "organisation_admin",
    status: body.status ?? "active",
  };

  const { data, error } = await supabaseAdmin
    .from("organisation_members")
    .upsert(payload, { onConflict: "organisation_id,email" })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    actor_type: "dashboard_user",
    action: "organisation_member.upserted",
    entity_type: "organisation_member",
    entity_id: data.id,
    metadata: { email: data.email, role: data.role },
  });

  return ok(data, 201);
}
