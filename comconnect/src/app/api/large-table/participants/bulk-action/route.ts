import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const action = String(body?.action ?? "");

  if (ids.length === 0) {
    return fail("ids array is required");
  }

  try {
    if (action === "archive") {
      const { data, error } = await supabaseAdmin
        .from("communication_schedules")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
        })
        .in("id", ids)
        .select("id");

      if (error) return fail(error.message, 500);

      return ok({
        action,
        updated_count: data?.length ?? 0,
      });
    }

    if (action === "status") {
      const status = String(body?.status ?? "").trim();

      if (!status) {
        return fail("status is required");
      }

      const { data, error } = await supabaseAdmin
        .from("communication_schedules")
        .update({
          status,
        })
        .in("id", ids)
        .select("id");

      if (error) return fail(error.message, 500);

      return ok({
        action,
        status,
        updated_count: data?.length ?? 0,
      });
    }

    return fail("Unsupported bulk action", 400);
  } catch (error: any) {
    return fail(error.message ?? "Bulk scheduler action failed", 400);
  }
}