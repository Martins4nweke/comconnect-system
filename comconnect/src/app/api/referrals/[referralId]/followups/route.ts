import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ referralId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { referralId } = await params;

  const { data, error } = await supabaseAdmin
    .from("referral_followups")
    .select("*")
    .eq("referral_id", referralId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { referralId } = await params;
  const body = await req.json().catch(() => null);

  const { data: referral, error: refError } = await supabaseAdmin
    .from("referrals")
    .select("id, organisation_id, project_id, participant_id")
    .eq("id", referralId)
    .single();

  if (refError || !referral) return fail("Referral not found", 404);

  const { data, error } = await supabaseAdmin
    .from("referral_followups")
    .insert({
      organisation_id: referral.organisation_id,
      project_id: referral.project_id,
      referral_id: referral.id,
      participant_id: referral.participant_id,
      followup_type: body?.followup_type ?? "call",
      status: body?.status ?? "pending",
      scheduled_for: body?.scheduled_for ?? null,
      note: body?.note ?? null,
      assigned_user_id: body?.assigned_user_id ?? null,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: referral.organisation_id,
    project_id: referral.project_id,
    actor_type: "dashboard_user",
    action: "referral_followup.created",
    entity_type: "referral",
    entity_id: referral.id,
    metadata: { followup_id: data.id },
  });

  return ok(data, 201);
}
