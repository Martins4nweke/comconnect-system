import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  let query = supabaseAdmin.from("participant_groups").select("*").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");
  if (!body?.name) return fail("Group name is required");

  const { data: project, error: projectError } = await supabaseAdmin.from("projects").select("id, organisation_id").eq("id", body.project_id).single();
  if (projectError || !project) return fail("Project not found", 404);

  const payload = {
    organisation_id: project.organisation_id,
    project_id: project.id,
    name: String(body.name).trim(),
    code: body.code ?? null,
    description: body.description ?? null,
    status: body.status ?? "active",
    metadata: body.metadata ?? {},
  };

  const { data, error } = await supabaseAdmin.from("participant_groups").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "participant_group.created",
    entity_type: "participant_group",
    entity_id: data.id,
    metadata: { name: data.name },
  });

  return ok(data, 201);
}
