import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getProjectOrganisation } from "@/lib/research-care/module-access";
import { requireString } from "@/lib/research-care/validation";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return fail("project_id is required");

  const { data, error } = await supabaseAdmin
    .from("fallback_rules")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");

  try {
    const project = await getProjectOrganisation(body.project_id);

    const { data, error } = await supabaseAdmin
      .from("fallback_rules")
      .insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        name: requireString(body.name, "name"),
        trigger_event: requireString(body.trigger_event, "trigger_event"),
        conditions: body.conditions ?? {},
        actions: body.actions ?? [],
        enabled: body.enabled ?? true,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);
    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create fallback rule", 400);
  }
}
