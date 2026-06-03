import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 100), 1),
      200
    );

    const participantId = searchParams.get("participant_id");
    const messageId = searchParams.get("message_id");

    let repliesQuery = supabaseAdmin
      .from("app_message_replies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (participantId) {
      repliesQuery = repliesQuery.eq("participant_id", participantId);
    }

    if (messageId) {
      repliesQuery = repliesQuery.eq("message_id", messageId);
    }

    const { data: replies, error: repliesError } = await repliesQuery;

    if (repliesError) {
      return fail(repliesError.message, 500);
    }

    const replyRows = Array.isArray(replies) ? replies : [];

    const participantIds = uniqueValues(
      replyRows.map((row: any) => row.participant_id)
    );

    const messageIds = uniqueValues(replyRows.map((row: any) => row.message_id));

    const [{ data: participants }, { data: messages }] = await Promise.all([
      participantIds.length > 0
        ? supabaseAdmin
            .from("participants")
            .select("id, participant_code, phone_number, first_name, last_name, metadata")
            .in("id", participantIds)
        : Promise.resolve({ data: [] as any[] }),

      messageIds.length > 0
        ? supabaseAdmin
            .from("app_messages")
            .select("id, title, body, message_code, channel, status, created_at")
            .in("id", messageIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const participantMap = new Map(
      (participants ?? []).map((participant: any) => [
        participant.id,
        participant,
      ])
    );

    const messageMap = new Map(
      (messages ?? []).map((message: any) => [message.id, message])
    );

    const data = replyRows.map((reply: any) => ({
      ...reply,
      participant: participantMap.get(reply.participant_id) ?? null,
      message: messageMap.get(reply.message_id) ?? null,
    }));

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load replies", 500);
  }
}