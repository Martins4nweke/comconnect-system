import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ consentFormId: string }> };

function applyConsentScope(
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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { consentFormId } = await params;

    let query = supabaseAdmin
      .from("consent_forms")
      .select("*, consent_versions(*)")
      .eq("id", consentFormId);

    query = applyConsentScope(query, context);

    const { data, error } = await query.maybeSingle();

    if (error) return fail(error.message, 500);

    if (!data) {
      return fail("Consent form not found or not allowed.", 404);
    }

    return ok(data);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load consent form", 500);
  }
}