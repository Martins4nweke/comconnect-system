import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const participantId = req.nextUrl.searchParams.get("participant_id");
  if (!projectId) return fail("project_id is required");

  let query = supabaseAdmin
    .from("help_requests")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (participantId) query = query.eq("participant_id", participantId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}
