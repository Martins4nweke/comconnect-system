import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const organisationId = req.nextUrl.searchParams.get("organisation_id");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  let query = supabaseAdmin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (projectId) query = query.eq("project_id", projectId);
  if (organisationId) query = query.eq("organisation_id", organisationId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}
