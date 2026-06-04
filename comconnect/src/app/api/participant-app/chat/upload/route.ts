import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { recordParticipantActivity } from "@/lib/participant-app/sync";

export const runtime = "nodejs";

const DEFAULT_BUCKET = "participant-chat-media";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseMediaType(value: unknown) {
  const text = cleanText(value).toLowerCase();

  if (text === "audio") return "audio";
  if (text === "video") return "video";
  if (text === "image") return "image";

  return null;
}

function safeFileName(value: string) {
  const cleaned = cleanText(value)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

  return cleaned || `chat-media-${Date.now()}`;
}

function extensionFromMime(mimeType: string, mediaType: string) {
  const mime = mimeType.toLowerCase();

  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("heic")) return "heic";

  if (mediaType === "audio") return "m4a";
  if (mediaType === "video") return "mp4";
  if (mediaType === "image") return "jpg";

  return "bin";
}

function mediaLabel(mediaType: string) {
  if (mediaType === "audio") return "Voice note";
  if (mediaType === "video") return "Video";
  if (mediaType === "image") return "Image";
  return "Media";
}

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  try {
    const form = await req.formData();

    const file = form.get("file");
    const mediaType = normaliseMediaType(form.get("media_type"));
    const messageText = cleanText(form.get("message_text"));
    const createdOfflineAtValue = form.get("created_offline_at");
const createdOfflineAt =
  typeof createdOfflineAtValue === "string" && createdOfflineAtValue.trim()
    ? createdOfflineAtValue.trim()
    : null;
    const localId =
      cleanText(form.get("local_id")) || `chat-media:${Date.now()}`;
    const requestedThreadId = cleanText(form.get("thread_id")) || null;

    if (!file || !(file instanceof File)) {
      return fail("A media file is required", 400);
    }

    if (!mediaType) {
      return fail("media_type must be audio, video, or image", 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return fail("Media file is too large. Maximum allowed size is 25 MB.", 400);
    }

    const mimeType =
      cleanText(file.type) ||
      (mediaType === "audio"
        ? "audio/m4a"
        : mediaType === "video"
        ? "video/mp4"
        : "image/jpeg");

    if (mediaType === "audio" && !mimeType.startsWith("audio/")) {
      return fail("Uploaded file must be an audio file", 400);
    }

    if (mediaType === "video" && !mimeType.startsWith("video/")) {
      return fail("Uploaded file must be a video file", 400);
    }

    if (mediaType === "image" && !mimeType.startsWith("image/")) {
      return fail("Uploaded file must be an image file", 400);
    }

    let threadId = requestedThreadId;

    if (threadId) {
      const { data: thread } = await supabaseAdmin
        .from("chat_threads")
        .select("id")
        .eq("id", threadId)
        .eq("participant_id", auth.context.participant_id)
        .maybeSingle();

      if (!thread) {
        return fail("Chat thread not found for this participant", 404);
      }
    } else {
      const { data: newThread, error: threadError } = await supabaseAdmin
        .from("chat_threads")
        .insert({
          organisation_id: auth.context.organisation_id,
          project_id: auth.context.project_id,
          participant_id: auth.context.participant_id,
          subject: "Participant media message",
          status: "open",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (threadError) {
        return fail(threadError.message, 500);
      }

      threadId = newThread.id;
    }

    const bucket = cleanText(process.env.CHAT_MEDIA_BUCKET) || DEFAULT_BUCKET;
    const now = new Date().toISOString();
    const originalName = safeFileName(file.name || `${mediaType}-${Date.now()}`);
    const extension = originalName.includes(".")
      ? originalName.split(".").pop()
      : extensionFromMime(mimeType, mediaType);

    const storagePath = [
      auth.context.organisation_id,
      auth.context.project_id,
      auth.context.participant_id,
      threadId,
      `${Date.now()}-${safeFileName(originalName)}${
        originalName.includes(".") ? "" : `.${extension}`
      }`,
    ]
      .filter(Boolean)
      .join("/");

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return fail(uploadError.message, 500);
    }

    const mediaPayload = {
      media_type: mediaType,
      bucket,
      storage_path: storagePath,
      file_name: originalName,
      mime_type: mimeType,
      file_size: file.size,
      uploaded_at: now,
      source: "participant_app_chat_upload",
    };

    const finalMessageText =
      messageText || `${mediaLabel(mediaType)} received from participant.`;

    const { data: message, error: messageError } = await supabaseAdmin
      .from("chat_messages")
      .upsert(
        {
          organisation_id: auth.context.organisation_id,
          project_id: auth.context.project_id,
          thread_id: threadId,
          participant_id: auth.context.participant_id,
          sender_type: "participant",
          local_id: localId,
          message_text: finalMessageText,
          payload: {
            message_text: finalMessageText,
            message_type: mediaType,
            media: mediaPayload,
          },
          created_offline_at: createdOfflineAt,
          synced_at: now,
        },
        { onConflict: "participant_id,local_id" }
      )
      .select("*")
      .single();

    if (messageError) {
      return fail(messageError.message, 500);
    }

    const { error: threadUpdateError } = await supabaseAdmin
      .from("chat_threads")
      .update({
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", threadId);

    if (threadUpdateError) {
      return fail(threadUpdateError.message, 500);
    }

    const { error: inboxError } = await supabaseAdmin.from("inbox_items").insert({
  organisation_id: auth.context.organisation_id,
  project_id: auth.context.project_id,
  participant_id: auth.context.participant_id,
  source_type: "chat_message",
  source_id: message.id,
  title: `New ${mediaLabel(mediaType).toLowerCase()} chat message`,
  summary: finalMessageText,
  priority: mediaType === "video" ? "medium" : "normal",
  status: "open",
});

if (inboxError) {
  return fail(inboxError.message, 500);
}
    await recordParticipantActivity(
      auth.context,
      "chat_media_sent",
      "chat_thread",
      threadId,
      {
        thread_id: threadId,
        message_id: message.id,
        message_text: finalMessageText,
        media: mediaPayload,
        source: "participant_app_chat_upload",
      },
      localId,
      createdOfflineAt
    );

    await createAuditLog({
      organisation_id: auth.context.organisation_id,
      project_id: auth.context.project_id,
      actor_type: "participant",
      action: "chat.media_sent",
      entity_type: "chat_thread",
      entity_id: threadId,
      metadata: {
        message_id: message.id,
        local_id: localId,
        media: mediaPayload,
      },
    });

    return ok(
      {
        thread_id: threadId,
        message,
        media: mediaPayload,
      },
      201
    );
  } catch (error: any) {
    return fail(error?.message ?? "Failed to upload chat media", 500);
  }
}