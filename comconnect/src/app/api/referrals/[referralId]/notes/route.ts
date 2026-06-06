import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ referralId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageReferrals(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
      "follow_up_officer",
    ].includes(projectRole)
  );
}

function applyReferralScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { referralId } = await params;

    let referralQuery = supabaseAdmin
      .from("referrals")
      .select("id, organisation_id, project_id")
      .eq("id", referralId);

    referralQuery = applyReferralScope(referralQuery, context);

    const { data: referral, error: referralError } =
      await referralQuery.maybeSingle();

    if (referralError) return fail(referralError.message, 500);

    if (!referral) {
      return fail("Referral not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("referral_notes")
      .select("*")
      .eq("organisation_id", referral.organisation_id)
      .eq("project_id", referral.project_id)
      .eq("referral_id", referral.id)
      .order("created_at", { ascending: false });

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load referral notes", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageReferrals(context)) {
      return fail("You do not have permission to create referral notes.", 403);
    }

    const { referralId } = await params;
    const body = await req.json().catch(() => null);

    let referralQuery = supabaseAdmin
      .from("referrals")
      .select("id, organisation_id, project_id, participant_id")
      .eq("id", referralId);

    referralQuery = applyReferralScope(referralQuery, context);

    const { data: referral, error: refError } =
      await referralQuery.maybeSingle();

    if (refError) return fail(refError.message, 500);

    if (!referral) {
      return fail("Referral not found or not allowed.", 404);
    }

    const note = cleanText(body?.note);

    if (!note) {
      return fail("note is required", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("referral_notes")
      .insert({
        organisation_id: referral.organisation_id,
        project_id: referral.project_id,
        referral_id: referral.id,
        participant_id: referral.participant_id,
        note,
        actor_user_id: body?.actor_user_id ?? null,
        metadata: {
          ...(body?.metadata ?? {}),
          created_from: body?.created_from ?? "referral_notes_api",
        },
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: referral.organisation_id,
      project_id: referral.project_id,
      actor_type: "dashboard_user",
      action: "referral_note.created",
      entity_type: "referral",
      entity_id: referral.id,
      metadata: {
        note_id: data.id,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create referral note", 400);
  }
}