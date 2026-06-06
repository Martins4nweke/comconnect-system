import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function findExistingOrganisation(params: {
  name: string;
  slug: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("organisations")
    .select("*")
    .or(`slug.eq.${params.slug},name.ilike.${params.name}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function cleanupAuthUser(userId: string) {
  await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => null);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const fullName = cleanText(body?.full_name);
    const email = cleanText(body?.email).toLowerCase();
    const password = String(body?.password ?? "");
    const organisationName = cleanText(body?.organisation_name);
    const useCase = cleanText(body?.use_case);
    const expectedParticipants = cleanText(body?.expected_participants);
    const preferredPlan = cleanText(body?.preferred_plan) || "Starter / trial";

    if (!fullName) return fail("Full name is required.", 400);
    if (!email) return fail("Email is required.", 400);
    if (!organisationName) return fail("Organisation name is required.", 400);
    if (password.length < 8) {
      return fail("Password must be at least 8 characters.", 400);
    }

    const organisationSlug = slugify(organisationName);

    if (!organisationSlug) {
      return fail("Organisation name is invalid.", 400);
    }

    const existingOrganisation = await findExistingOrganisation({
      name: organisationName,
      slug: organisationSlug,
    });

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          organisation_name: organisationName,
          use_case: useCase,
          expected_participants: expectedParticipants,
          preferred_plan: preferredPlan,
          signup_source: "public_signup_api",
        },
      });

    if (authError) {
      return fail(authError.message, 400);
    }

    const userId = authUser.user?.id;

    if (!userId) {
      return fail("Failed to create user account.", 500);
    }

    /*
      Existing organisation:
      Do not create duplicate organisation.
      Add user as invited viewer. Organisation admin must approve access.
    */
    if (existingOrganisation?.id) {
      const { data: existingMember, error: existingMemberError } =
        await supabaseAdmin
          .from("organisation_members")
          .select("*")
          .eq("organisation_id", existingOrganisation.id)
          .or(`email.eq.${email},user_id.eq.${userId}`)
          .maybeSingle();

      if (existingMemberError) {
        await cleanupAuthUser(userId);
        return fail(existingMemberError.message, 500);
      }

      if (existingMember) {
        await cleanupAuthUser(userId);
        return fail(
          "This user is already linked to the organisation. Please login or contact your organisation admin.",
          409
        );
      }

      const { data: invitedMember, error: memberError } = await supabaseAdmin
        .from("organisation_members")
        .insert({
          organisation_id: existingOrganisation.id,
          user_id: userId,
          email,
          full_name: fullName,
          role: "viewer",
          status: "invited",
        })
        .select("*")
        .single();

      if (memberError) {
        await cleanupAuthUser(userId);
        return fail(memberError.message, 500);
      }

      return ok(
        {
          user: {
            id: userId,
            email,
            full_name: fullName,
          },
          organisation: {
            id: existingOrganisation.id,
            name: existingOrganisation.name,
            slug: existingOrganisation.slug,
            already_exists: true,
          },
          member: {
            id: invitedMember.id,
            role: invitedMember.role,
            status: invitedMember.status,
          },
          access_pending: true,
          message:
            "Account created. This organisation already exists, so access must be approved by an organisation admin before you can view organisation data.",
        },
        201
      );
    }

    /*
      New organisation:
      Create organisation, active organisation admin, 5-day trial subscription,
      and inactive wallet.
    */
    const trialStartsAt = new Date();
    const trialEndsAt = new Date(
      trialStartsAt.getTime() + 5 * 24 * 60 * 60 * 1000
    );

    const { data: organisation, error: organisationError } =
      await supabaseAdmin
        .from("organisations")
        .insert({
          name: organisationName,
          slug: organisationSlug,
          primary_colour: "#0A5278",
          support_email: email,
          status: "active",
          settings: {
            signup_source: "public_signup_api",
            trial_access: true,
            trial_days: 5,
            trial_scope: "participant_app_testing_only",
            use_case: useCase || null,
            expected_participants: expectedParticipants || null,
            preferred_plan: preferredPlan,
            paid_channels_require_wallet: true,
          },
        })
        .select("*")
        .single();

    if (organisationError) {
      await cleanupAuthUser(userId);
      return fail(organisationError.message, 500);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("organisation_members")
      .insert({
        organisation_id: organisation.id,
        user_id: userId,
        email,
        full_name: fullName,
        role: "organisation_admin",
        status: "active",
      })
      .select("*")
      .single();

    if (memberError) {
      try {
        await supabaseAdmin
          .from("organisations")
          .delete()
          .eq("id", organisation.id);
      } catch {
        // Ignore cleanup failure.
      }

      await cleanupAuthUser(userId);
      return fail(memberError.message, 500);
    }

    const { data: subscription, error: subscriptionError } =
      await supabaseAdmin
        .from("billing_subscriptions")
        .insert({
          organisation_id: organisation.id,
          plan_name: preferredPlan,
          status: "trial",
          trial_starts_at: trialStartsAt.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
          metadata: {
            trial_days: 5,
            access_scope: "comconnect_and_participant_app",
            paid_channels_included: false,
            paid_channels_require_wallet: true,
            created_from: "public_signup_api",
          },
        })
        .select("*")
        .single();

    if (subscriptionError) {
      await cleanupAuthUser(userId);
      return fail(subscriptionError.message, 500);
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("billing_wallets")
      .insert({
        organisation_id: organisation.id,
        status: "inactive",
        currency: "ZAR",
        balance: 0,
        sms_enabled: false,
        voice_enabled: false,
        whatsapp_enabled: false,
        metadata: {
          created_from: "public_signup_api",
          reason: "paid_channels_require_wallet_topup",
        },
      })
      .select("*")
      .single();

    if (walletError) {
      await cleanupAuthUser(userId);
      return fail(walletError.message, 500);
    }

    return ok(
      {
        user: {
          id: userId,
          email,
          full_name: fullName,
        },
        organisation: {
          id: organisation.id,
          name: organisation.name,
          slug: organisation.slug,
          already_exists: false,
        },
        member: {
          id: member.id,
          role: member.role,
          status: member.status,
        },
        subscription: {
          id: subscription.id,
          plan_name: subscription.plan_name,
          status: subscription.status,
          trial_starts_at: subscription.trial_starts_at,
          trial_ends_at: subscription.trial_ends_at,
        },
        wallet: {
          id: wallet.id,
          status: wallet.status,
          balance: wallet.balance,
          sms_enabled: wallet.sms_enabled,
          voice_enabled: wallet.voice_enabled,
          whatsapp_enabled: wallet.whatsapp_enabled,
        },
        active_project_id: null,
        active_project_name: null,
        access_pending: false,
        message:
          "Account created. Your organisation has a 5-day trial for ComConnect and the Participant app. Paid channels require subscription activation and a funded wallet.",
      },
      201
    );
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create account.", 500);
  }
}