import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { verifyParticipantInProject } from "@/lib/research-care/module-access";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManagePushQueue(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    ["project_manager", "data_manager"].includes(projectRole)
  );
}

function resolveAllowedProjectId(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  requestedProjectId?: string | null
) {
  const requested = cleanText(requestedProjectId);

  if (requested) {
    if (
      requested === context.active_project_id ||
      context.allowed_project_ids.includes(requested)
    ) {
      return requested;
    }

    throw new Error("Project not found or not allowed.");
  }

  if (context.active_project_id) return context.active_project_id;

  if (context.allowed_project_ids.length > 0) {
    return context.allowed_project_ids[0];
  }

  throw new Error("No accessible project found.");
}

function removeSensitivePushFields(row: any) {
  const safeRow = { ...(row ?? {}) };

  delete safeRow.push_token;
  delete safeRow.device_token;
  delete safeRow.expo_push_token;

  return safeRow;
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const requestedProjectId = req.nextUrl.searchParams.get("project_id");
    const projectId = requestedProjectId
      ? resolveAllowedProjectId(context, requestedProjectId)
      : null;

    let query = supabaseAdmin
      .from("push_notification_queue")
      .select(
        "*, participants(participant_code, first_name, last_name, phone_number, metadata)"
      )
      .eq("organisation_id", context.organisation_id)
      .order("scheduled_for", { ascending: true })
      .limit(200);

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => removeSensitivePushFields(row));

    return ok(rows);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load push queue", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManagePushQueue(context)) {
      return fail("You do not have permission to queue push notifications.", 403);
    }

    const body = await req.json().catch(() => null);

    if (!body?.project_id) return fail("project_id is required");
    if (!body?.participant_id) return fail("participant_id is required");

    const projectId = resolveAllowedProjectId(context, body.project_id);

    const participant = await verifyParticipantInProject(
      body.participant_id,
      projectId
    );

    if (participant.organisation_id !== context.organisation_id) {
      return fail("Participant not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("push_notification_queue")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        title: body?.title ?? "ComConnect",
        body: body?.body ?? "You have a new ComConnect update.",
        data: body?.data ?? {},
        status: "pending",
        scheduled_for: body?.scheduled_for ?? new Date().toISOString(),
        metadata: {
          ...(body?.metadata ?? {}),
          created_from: body?.created_from ?? "push_queue_api",
        },
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(removeSensitivePushFields(data), 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to queue push notification", 400);
  }
}