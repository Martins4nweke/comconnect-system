import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { verifyParticipantInProject } from "@/lib/research-care/module-access";

const DEFAULT_BUCKET = "participant-chat-media";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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

  if (value === "image" || value === "photo") {
    return "image";
  }

  if (value === "video") {
    return "video";
  }

  if (value === "file") {
    return "file";
  }

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

  if (existingUrl) {
    return existingUrl;
  }

  const storagePath = extractStoragePath(payload);
  const bucket = extractStorageBucket(payload);

  if (!storagePath) {
    return "";
  }

  const { data: signedData } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);

  if (signedData?.signedUrl) {
    return signedData.signedUrl;
  }

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

async function enrichThread(thread: any) {
  const messages = Array.isArray(thread?.chat_messages)
    ? thread.chat_messages
    : [];

  const enrichedMessages = await Promise.all(
    messages
      .slice()
      .sort((a: any, b: any) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
      )
      .map((message: any) => enrichChatMessage(message))
  );

  return {
    ...thread,
    chat_messages: enrichedMessages,
  };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const participantId = req.nextUrl.searchParams.get("participant_id");
  const threadId = req.nextUrl.searchParams.get("thread_id");

  /*
    Thread detail mode:
    Used by /chat/[threadId].
    In this mode, project_id is not required because the thread ID is already unique.
  */
  if (threadId) {
    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .select(
        "*, participants(participant_code, display_name, phone_number), chat_messages(*)"
      )
      .eq("id", threadId)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Chat thread not found", 404);

    const enrichedThread = await enrichThread(data);

    return ok([enrichedThread]);
  }

  /*
    Thread list mode:
    Used by /chat table.
    In this mode, project_id is required so we do not load all projects.
  */
  if (!projectId) return fail("project_id is required");

  let query = supabaseAdmin
    .from("chat_threads")
    .select(
      "*, participants(participant_code, display_name, phone_number), chat_messages(*)"
    )
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  const enrichedThreads = await Promise.all(
    (data ?? []).map((thread: any) => enrichThread(thread))
  );

  return ok(enrichedThreads);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.project_id) return fail("project_id is required");
  if (!body?.participant_id) return fail("participant_id is required");

  try {
    const participant = await verifyParticipantInProject(
      body.participant_id,
      body.project_id
    );

    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        subject: body.subject ?? null,
        status: body.status ?? "open",
        assigned_user_id: body.assigned_user_id ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create chat thread", 400);
  }
}