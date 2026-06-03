import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return fail("project_id is required");

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");
  if (!body?.email) return fail("email is required");

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id")
    .eq("id", body.project_id)
    .single();

  if (projectError || !project) return fail("Project not found", 404);

  const payload = {
    organisation_id: project.organisation_id,
    project_id: project.id,
    user_id: body.user_id ?? null,
    email: String(body.email).trim().toLowerCase(),
    full_name: body.full_name ?? null,
    role: body.role ?? "research_assistant",
    status: body.status ?? "active",
  };

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .upsert(payload, { onConflict: "project_id,email" })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "project_member.upserted",
    entity_type: "project_member",
    entity_id: data.id,
    metadata: { email: data.email, role: data.role },
  });

  return ok(data, 201);
}
