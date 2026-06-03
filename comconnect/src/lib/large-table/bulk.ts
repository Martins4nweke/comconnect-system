import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BulkActionPayload } from "./types";

export function validateBulkPayload(payload: BulkActionPayload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid payload");
  if (!payload.action) throw new Error("action is required");
  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    throw new Error("ids array is required");
  }
  if (payload.ids.length > 1000) {
    throw new Error("Bulk action limit is 1000 records per request");
  }
}

export function buildBulkUpdate(payload: BulkActionPayload) {
  const now = new Date().toISOString();

  if (payload.action === "archive") return { status: "archived", archived_at: now };
  if (payload.action === "activate") return { status: "active", archived_at: null };
  if (payload.action === "deactivate") return { status: "inactive" };
  if (payload.action === "cancel") return { status: "cancelled" };
  if (payload.action === "complete") return { status: "completed" };
  if (payload.action === "resolve") return { status: "resolved" };
  if (payload.action === "assign") return { assigned_user_id: payload.assigned_user_id ?? null };
  if (payload.action === "status") {
    if (!payload.status) throw new Error("status is required for status action");
    return { status: payload.status };
  }

  throw new Error("Unsupported bulk action");
}

export async function bulkUpdateTable(table: string, payload: BulkActionPayload) {
  validateBulkPayload(payload);
  const update = buildBulkUpdate(payload);

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(update)
    .in("id", payload.ids)
    .select("id");

  if (error) throw new Error(error.message);

  return {
    updated: data?.length ?? 0,
    ids: data?.map((row: any) => row.id) ?? [],
  };
}
