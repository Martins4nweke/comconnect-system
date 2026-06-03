import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ referralId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { referralId } = await params;

  const { data, error } = await supabaseAdmin
    .from("referral_notes")
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

  if (!body?.note) return fail("note is required");

  const { data, error } = await supabaseAdmin
    .from("referral_notes")
    .insert({
      organisation_id: referral.organisation_id,
      project_id: referral.project_id,
      referral_id: referral.id,
      participant_id: referral.participant_id,
      note: body.note,
      actor_user_id: body.actor_user_id ?? null,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, 201);
}
