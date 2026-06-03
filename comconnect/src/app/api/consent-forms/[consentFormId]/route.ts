import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ consentFormId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { consentFormId } = await params;

  const { data, error } = await supabaseAdmin
    .from("consent_forms")
    .select("*, consent_versions(*)")
    .eq("id", consentFormId)
    .single();

  if (error) return fail("Consent form not found", 404);
  return ok(data);
}
