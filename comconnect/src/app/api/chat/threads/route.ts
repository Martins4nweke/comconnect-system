import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";
import { verifyParticipantInProject } from "@/lib/research-care/module-access";

const DEFAULT_BUCKET = "participant-chat-media";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageChat(context: Awaited<ReturnType<typeof getScopedContext>>) {
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

function applyProjectScope(
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

  if (context.active_project_id) {
    return context.active_project_id;
  }

  if (context.allowed_project_ids.length > 0) {
    return context.allowed_project_ids[0];
  }

  throw new Error("No accessible project found.");
}

function extractMessageType(payload: any) {
  const value = cleanText(
    payload?.message_type ??
      payload?.media_type ??
      payload?.media?.message_type ??
      payload?.media?.media_type
  ).toLowerCase();

  if (value === "audio" || value === "voice" || value === "voice_note") {
    return "audio";
  }

  if (value === "image" || value === "photo") return "image";
  if (value === "video") return "video";
  if (value === "file") return "file";

  return "text";
}

function extractStorageBucket(payload: any) {
  return (
    cleanText(
      payload?.storage_bucket ??
        payload?.bucket ??
        payload?.media?.storage_bucket ??
        payload?.media?.bucket
    ) || DEFAULT_BUCKET
  );
}

function extractStoragePath(payload: any) {
  return cleanText(
    payload?.storage_path ??
      payload?.path ??
      payload?.media?.storage_path ??
      payload?.media?.path
  );
}

function extractExistingMediaUrl(payload: any) {
  return cleanText(
    payload?.media_url ??
      payload?.url ??
      payload?.file_url ??
      payload?.media?.media_url ??
      payload?.media?.url ??
      payload?.media?.file_url
  );
}

function extractMimeType(payload: any) {
  return cleanText(
    payload?.media_mime_type ??
      payload?.mime_type ??
      payload?.media?.media_mime_type ??
      payload?.media?.mime_type
  );
}

function extractFileName(payload: any) {
  return cleanText(
    payload?.media_filename ??
      payload?.file_name ??
      payload?.media?.media_filename ??
      payload?.media?.file_name
  );
}

function extractFileSize(payload: any) {
  return (
    payload?.media_size ??
    payload?.file_size ??
    payload?.media?.media_size ??
    payload?.media?.file_size ??
    null
  );
}

async function createMediaUrl(payload: any) {
  const existingUrl = extractExistingMediaUrl(payload);

  if (existingUrl) return existingUrl;

  const storagePath = extractStoragePath(payload);
  const bucket = extractStorageBucket(payload);

  if (!storagePath) return "";

  const { data: signedData } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);

  if (signedData?.signedUrl) return signedData.signedUrl;

  const { data: publicData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return publicData?.publicUrl ?? "";
}

async function enrichChatMessage(message: any) {
  const payload = message?.payload ?? {};
  const messageType = extractMessageType(payload);

  if (messageType === "text") {
    return {
      ...message,
      payload: {
        ...payload,
        message_type: "text",
        message_text: payload?.message_text ?? message?.message_text ?? "",
      },
    };
  }

  const mediaUrl = await createMediaUrl(payload);
  const mimeType = extractMimeType(payload);
  const fileName = extractFileName(payload);
  const fileSize = extractFileSize(payload);
  const bucket = extractStorageBucket(payload);
  const storagePath = extractStoragePath(payload);

  return {
    ...message,
    payload: {
      ...payload,
      message_text: payload?.message_text ?? message?.message_text ?? "",
      message_type: messageType,

      media_type: messageType,
      media_url: mediaUrl || null,
      media_mime_type: mimeType || null,
      media_filename: fileName || null,
      media_size: fileSize,
      storage_bucket: bucket || null,
      storage_path: storagePath || null,

      media: {
        ...(payload?.media ?? {}),
        media_type: messageType,
        message_type: messageType,
        media_url: mediaUrl || payload?.media?.media_url || null,
        url: mediaUrl || payload?.media?.url || null,
        media_mime_type: mimeType || payload?.media?.media_mime_type || null,
        mime_type: mimeType || payload?.media?.mime_type || null,
        media_filename: fileName || payload?.media?.media_filename || null,
        file_name: fileName || payload?.media?.file_name || null,
        media_size: fileSize ?? payload?.media?.media_size ?? null,
        file_size: fileSize ?? payload?.media?.file_size ?? null,
        storage_bucket: bucket || payload?.media?.storage_bucket || null,
        bucket: bucket || payload?.media?.bucket || null,
        storage_path: storagePath || payload?.media?.storage_path || null,
      },
    },
  };
}

async function loadMessagesForThread({
  context,
  threadId,
}: {
  context: Awaited<ReturnType<typeof getScopedContext>>;
  threadId: string;
}) {
  let query = supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("organisation_id", context.organisation_id)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (context.active_project_id) {
    query = query.eq("project_id", context.active_project_id);
  } else if (context.allowed_project_ids.length > 0) {
    query = query.in("project_id", context.allowed_project_ids);
  } else {
    query = query.eq("project_id", "__no_project_access__");
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return Promise.all((data ?? []).map((message: any) => enrichChatMessage(message)));
}

async function attachMessagesToThread({
  context,
  thread,
}: {
  context: Awaited<ReturnType<typeof getScopedContext>>;
  thread: any;
}) {
  const messages = await loadMessagesForThread({
    context,
    threadId: thread.id,
  });

  return {
    ...thread,
    chat_messages: messages,
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const requestedProjectId = req.nextUrl.searchParams.get("project_id");
    const participantId = cleanText(req.nextUrl.searchParams.get("participant_id"));
    const threadId = cleanText(req.nextUrl.searchParams.get("thread_id"));

    if (threadId) {
      let query = supabaseAdmin
        .from("chat_threads")
        .select(
          "*, participants(participant_code, phone_number, first_name, last_name, metadata)"
        )
        .eq("id", threadId);

      query = applyProjectScope(query, context);

      const { data: thread, error } = await query.maybeSingle();

      if (error) return fail(error.message, 500);
      if (!thread) return fail("Chat thread not found or not allowed.", 404);

      const threadWithMessages = await attachMessagesToThread({
        context,
        thread,
      });

      return ok([threadWithMessages]);
    }

    const projectId = requestedProjectId
      ? resolveAllowedProjectId(context, requestedProjectId)
      : null;

    let query = supabaseAdmin
      .from("chat_threads")
      .select(
        "*, participants(participant_code, phone_number, first_name, last_name, metadata)"
      )
      .eq("organisation_id", context.organisation_id)
      .order("updated_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const threadsWithMessages = await Promise.all(
      (data ?? []).map((thread: any) =>
        attachMessagesToThread({
          context,
          thread,
        })
      )
    );

    return ok(threadsWithMessages);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load chat threads", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageChat(context)) {
      return fail("You do not have permission to create chat threads.", 403);
    }

    const body = await req.json().catch(() => null);
    const projectId = resolveAllowedProjectId(context, body?.project_id);
    const participantId = cleanText(body?.participant_id);

    if (!participantId) return fail("participant_id is required", 400);

    const participant = await verifyParticipantInProject(
      participantId,
      projectId
    );

    if (participant.organisation_id !== context.organisation_id) {
      return fail("Participant not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        subject: body?.subject ?? null,
        status: body?.status ?? "open",
        assigned_user_id: body?.assigned_user_id ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create chat thread", 400);
  }
}