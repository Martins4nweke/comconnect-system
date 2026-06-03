import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ observationTypeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { observationTypeId } = await params;

  const { data, error } = await supabaseAdmin
    .from("observation_alert_rules")
    .select("*")
    .eq("observation_type_id", observationTypeId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { observationTypeId } = await params;
  const body = await req.json().catch(() => null);

  const { data: obsType, error: obsError } = await supabaseAdmin
    .from("project_observation_types")
    .select("id, organisation_id, project_id")
    .eq("id", observationTypeId)
    .single();

  if (obsError || !obsType) return fail("Observation type not found", 404);

  const { data, error } = await supabaseAdmin
    .from("observation_alert_rules")
    .insert({
      organisation_id: obsType.organisation_id,
      project_id: obsType.project_id,
      observation_type_id: obsType.id,
      name: body?.name ?? "Alert rule",
      rule_json: body?.rule_json ?? {},
      severity: body?.severity ?? "high",
      enabled: body?.enabled ?? true,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: obsType.organisation_id,
    project_id: obsType.project_id,
    actor_type: "dashboard_user",
    action: "observation_alert_rule.created",
    entity_type: "project_observation_type",
    entity_id: obsType.id,
    metadata: { rule_id: data.id, severity: data.severity },
  });

  return ok(data, 201);
}
