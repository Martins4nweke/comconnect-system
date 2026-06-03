import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET() {
  const { data, error } = await supabaseAdmin.from("organisations").select("*").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return fail("Organisation name is required");

  const payload = {
    name: String(body.name).trim(),
    slug: body.slug ? slugify(String(body.slug)) : slugify(String(body.name)),
    logo_url: body.logo_url ?? null,
    primary_colour: body.primary_colour ?? "#F26A21",
    support_email: body.support_email ?? null,
    support_phone: body.support_phone ?? null,
    status: body.status ?? "active",
    settings: body.settings ?? {},
  };

  const { data, error } = await supabaseAdmin.from("organisations").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.id,
    actor_type: "dashboard_user",
    action: "organisation.created",
    entity_type: "organisation",
    entity_id: data.id,
    metadata: { name: data.name },
  });

  return ok(data, 201);
}
