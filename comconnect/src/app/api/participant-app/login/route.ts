import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  createParticipantSessionToken,
  hashParticipantSessionToken,
} from "@/lib/participant-app/session-token";
import { registerParticipantDevice } from "@/lib/participant-app/device";
import { getParticipantAppConfig } from "@/lib/participant-app/config";
import {
  hasTooManyRecentLoginFailures,
  normaliseParticipantPhone,
} from "@/lib/participant-app/login-security";

function buildPhoneVariants(value: unknown) {
  const raw = String(value ?? "").trim();
  const normalised = normaliseParticipantPhone(raw);
  const variants = new Set<string>();

  function add(v: unknown) {
    const s = String(v ?? "").trim();
    if (s) variants.add(s);
  }

  add(raw);
  add(normalised);

  const noSpaces = raw.replace(/\s+/g, "");
  const noPlus = noSpaces.replace(/^\+/, "");

  add(noSpaces);
  add(noPlus);

  if (noPlus.startsWith("27")) {
    add(`+${noPlus}`);
    add(`0${noPlus.slice(2)}`);
  }

  if (noPlus.startsWith("0") && noPlus.length === 10) {
    add(`27${noPlus.slice(1)}`);
    add(`+27${noPlus.slice(1)}`);
  }

  return Array.from(variants);
}

function phonesMatch(inputPhone: unknown, storedPhone: unknown) {
  const inputVariants = buildPhoneVariants(inputPhone);
  const storedVariants = buildPhoneVariants(storedPhone);

  return inputVariants.some((input) => storedVariants.includes(input));
}

function normalisePushToken(value: unknown) {
  const token = String(value ?? "").trim();

  if (!token) return null;

  if (!token.startsWith("ExponentPushToken[")) {
    return null;
  }

  return token;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const organisationSlug = body?.organisation_slug
    ? String(body.organisation_slug).trim()
    : null;

  const projectCode = String(body?.project_code ?? "").trim();
  const participantCode = String(body?.participant_code ?? "").trim();
  const rawPhoneNumber = String(body?.phone_number ?? "").trim();
  const phoneNumber = normaliseParticipantPhone(rawPhoneNumber) || rawPhoneNumber;
  const device = body?.device ?? {};
  const pushToken = normalisePushToken(device?.push_token);

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const userAgent = req.headers.get("user-agent");

  if (!projectCode) return fail("project_code is required");
  if (!participantCode) return fail("participant_code is required");
  if (!rawPhoneNumber) return fail("phone_number is required");

  const tooManyFailures = await hasTooManyRecentLoginFailures({
    project_code: projectCode,
    participant_code: participantCode,
    phone_number: phoneNumber,
  });

  if (tooManyFailures) {
    return fail("Too many failed login attempts. Please try again later.", 429);
  }

  const { data: projectMatches, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code, status, app_access_enabled")
    .eq("project_code", projectCode)
    .limit(2);

  if (projectError) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason: "project_lookup_error",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail(`DEBUG: project_lookup_error: ${projectError.message}`, 401);
  }

  const project = projectMatches?.length === 1 ? projectMatches[0] : null;

  if (!project) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason:
        projectMatches && projectMatches.length > 1
          ? "project_code_ambiguous"
          : "project_not_found",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail(
      projectMatches && projectMatches.length > 1
        ? "DEBUG: project_code_ambiguous"
        : "DEBUG: project_not_found",
      401
    );
  }

  if (organisationSlug) {
    const { data: organisation, error: organisationError } = await supabaseAdmin
      .from("organisations")
      .select("id, slug")
      .eq("id", project.organisation_id)
      .maybeSingle();

    if (organisationError) {
      await supabaseAdmin.from("participant_login_attempts").insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        project_code: projectCode,
        participant_code: participantCode,
        phone_number: phoneNumber,
        success: false,
        failure_reason: "organisation_lookup_error",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return fail(
        `DEBUG: organisation_lookup_error: ${organisationError.message}`,
        401
      );
    }

    if (!organisation || organisation.slug !== organisationSlug) {
      await supabaseAdmin.from("participant_login_attempts").insert({
        organisation_id: project.organisation_id,
        project_id: project.id,
        project_code: projectCode,
        participant_code: participantCode,
        phone_number: phoneNumber,
        success: false,
        failure_reason: "organisation_slug_mismatch",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return fail(
        `DEBUG: organisation_slug_mismatch. Expected ${
          organisation?.slug ?? "none"
        }, received ${organisationSlug}`,
        401
      );
    }
  }

  const { data: participant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select(
      "id, organisation_id, project_id, participant_code, phone_number, status, app_access_enabled"
    )
    .eq("project_id", project.id)
    .eq("participant_code", participantCode)
    .maybeSingle();

  if (participantError) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      organisation_id: project.organisation_id,
      project_id: project.id,
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason: "participant_lookup_error",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail(`DEBUG: participant_lookup_error: ${participantError.message}`, 401);
  }

  if (!participant) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      organisation_id: project.organisation_id,
      project_id: project.id,
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason: "participant_not_found",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail("DEBUG: participant_not_found", 401);
  }

  if (!participant.phone_number) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason: "participant_phone_not_enrolled",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail("Participant phone number is not enrolled for app login", 403);
  }

  if (!phonesMatch(rawPhoneNumber, participant.phone_number)) {
    await supabaseAdmin.from("participant_login_attempts").insert({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      project_code: projectCode,
      participant_code: participantCode,
      phone_number: phoneNumber,
      success: false,
      failure_reason: "phone_mismatch",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return fail(
      `DEBUG: phone_mismatch. Stored ${participant.phone_number}, received ${rawPhoneNumber}`,
      401
    );
  }

  if (project.status !== "active" || !project.app_access_enabled) {
    return fail("Project app access is not active", 403);
  }

  if (participant.status !== "active" || !participant.app_access_enabled) {
    return fail("Participant app access is not active", 403);
  }

  const sessionToken = createParticipantSessionToken();
  const sessionTokenHash = hashParticipantSessionToken(sessionToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("participant_app_sessions")
    .insert({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      session_token_hash: sessionTokenHash,
      device_id: device.device_id ?? null,
      platform: device.platform ?? null,
      app_version: device.app_version ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select(
      "id, organisation_id, project_id, participant_id, device_id, platform, app_version"
    )
    .single();

  if (sessionError) return fail(sessionError.message, 500);

  if (device?.device_id) {
    const devicePayload = {
      ...device,
      push_token: pushToken,
      push_provider: pushToken ? "expo" : null,
      push_token_updated_at: pushToken ? new Date().toISOString() : null,
    };

    await registerParticipantDevice(
      {
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        device_id: device.device_id,
        platform: device.platform,
        app_version: device.app_version,
      },
      devicePayload
    );
  }

  await supabaseAdmin.from("participant_login_attempts").insert({
    organisation_id: participant.organisation_id,
    project_id: participant.project_id,
    participant_id: participant.id,
    project_code: projectCode,
    participant_code: participantCode,
    phone_number: phoneNumber,
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  await createAuditLog({
    organisation_id: participant.organisation_id,
    project_id: participant.project_id,
    actor_type: "participant",
    actor_label: participant.participant_code,
    action: "participant_app.login_success",
    entity_type: "participant",
    entity_id: participant.id,
    metadata: {
      device_id: device.device_id ?? null,
      platform: device.platform ?? null,
      app_version: device.app_version ?? null,
      push_token_registered: Boolean(pushToken),
      push_provider: pushToken ? "expo" : null,
    },
  });

  const config = await getParticipantAppConfig({
    session_id: session.id,
    organisation_id: session.organisation_id,
    project_id: session.project_id,
    participant_id: session.participant_id,
    device_id: session.device_id,
    platform: session.platform,
    app_version: session.app_version,
  });

  return ok(
    {
      session_token: sessionToken,
      session_id: session.id,
      config,
      push_token_registered: Boolean(pushToken),
    },
    201
  );
}