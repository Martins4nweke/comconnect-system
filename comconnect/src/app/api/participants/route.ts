import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canWriteParticipants(context: Awaited<ReturnType<typeof getScopedContext>>) {
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
    ].includes(projectRole)
  );
}

async function resolveProject(body: any, context: Awaited<ReturnType<typeof getScopedContext>>) {
  const projectId = cleanText(body?.project_id) || cleanText(context.active_project_id);
  const projectCode = cleanText(body?.project_code);

  let query = supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code")
    .eq("organisation_id", context.organisation_id)
    .neq("status", "archived");

  if (projectId) {
    query = query.eq("id", projectId);
  } else if (projectCode) {
    query = query.eq("project_code", projectCode);
  } else {
    throw new Error("No active project selected.");
  }

  const { data: project, error } = await query.maybeSingle();

  if (error || !project) {
    throw new Error("Project not found or not allowed.");
  }

  if (!context.allowed_project_ids.includes(project.id)) {
    throw new Error("You do not have access to this project.");
  }

  return project;
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const q = req.nextUrl.searchParams.get("q");

    let query = supabaseAdmin
      .from("participants")
      .select("*, projects(name, project_code), organisations(name)")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (q) {
      query = query.or(
        `participant_code.ilike.%${q}%,phone_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load participants", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canWriteParticipants(context)) {
      return fail("You do not have permission to create participants.", 403);
    }

    const body = await req.json().catch(() => null);

    if (!body?.participant_code) {
      return fail("participant_code is required", 400);
    }

    const project = await resolveProject(body, context);
    const participantCode = cleanText(body.participant_code);

    const metadata = {
      ...(body.metadata ?? {}),
      display_name: body.display_name ?? null,
      email: body.email ?? null,
      whatsapp_number: body.whatsapp_number ?? null,
      preferred_channel: body.preferred_channel ?? "app",
      fallback_allowed: body.fallback_allowed ?? true,
      quiet_time_enabled: body.quiet_time_enabled ?? true,
      quiet_time_start: body.quiet_time_start ?? "20:00",
      quiet_time_end: body.quiet_time_end ?? "07:00",
      timezone: body.timezone ?? "Africa/Johannesburg",
      source: body.source ?? "participants_page",
    };

    const payload = {
      organisation_id: context.organisation_id,
      project_id: project.id,
      participant_code: participantCode,
      phone_number: body.phone_number ?? null,
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      preferred_language: body.preferred_language ?? "en",
      status: body.status ?? "active",
      app_access_enabled: body.app_access_enabled ?? true,
      metadata,
    };

    const { data, error } = await supabaseAdmin
      .from("participants")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await createAuditLog({
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      actor_type: "dashboard_user",
      action: "participant.created",
      entity_type: "participant",
      entity_id: data.id,
      metadata: {
        participant_code: data.participant_code,
        project_code: project.project_code ?? null,
        preferred_channel: metadata.preferred_channel,
      },
    });

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create participant", 400);
  }
}