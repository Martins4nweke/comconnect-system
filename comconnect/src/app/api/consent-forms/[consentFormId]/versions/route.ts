import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ consentFormId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { consentFormId } = await params;
  const body = await req.json().catch(() => null);

  const { data: form, error: formError } = await supabaseAdmin
    .from("consent_forms")
    .select("id, organisation_id, project_id")
    .eq("id", consentFormId)
    .single();

  if (formError || !form) return fail("Consent form not found", 404);

  const { data, error } = await supabaseAdmin
    .from("consent_versions")
    .insert({
      organisation_id: form.organisation_id,
      project_id: form.project_id,
      consent_form_id: form.id,
      version_label: body?.version_label ?? "v1.0",
      study_information: body?.study_information ?? null,
      privacy_information: body?.privacy_information ?? null,
      risks_benefits: body?.risks_benefits ?? null,
      voluntary_participation: body?.voluntary_participation ?? null,
      contact_details: body?.contact_details ?? null,
      checkbox_statements: body?.checkbox_statements ?? [],
      full_text: body?.full_text ?? null,
      status: body?.status ?? "draft",
      published_at: body?.status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  if (data.status === "published") {
    await supabaseAdmin
      .from("consent_forms")
      .update({ current_version_id: data.id, status: "published" })
      .eq("id", form.id);
  }

  return ok(data, 201);
}
