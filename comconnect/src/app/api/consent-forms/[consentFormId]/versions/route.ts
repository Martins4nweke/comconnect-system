import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ consentFormId: string }> };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageConsent(context: Awaited<ReturnType<typeof getScopedContext>>) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

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

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageConsent(context)) {
      return fail("You do not have permission to create consent versions.", 403);
    }

    const { consentFormId } = await params;
    const body = await req.json().catch(() => null);

    let formQuery = supabaseAdmin
      .from("consent_forms")
      .select("id, organisation_id, project_id")
      .eq("id", consentFormId);

    formQuery = applyConsentScope(formQuery, context);

    const { data: form, error: formError } = await formQuery.maybeSingle();

    if (formError) return fail(formError.message, 500);

    if (!form) {
      return fail("Consent form not found or not allowed.", 404);
    }

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
        published_at:
          body?.status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    if (data.status === "published") {
      const updateQuery = supabaseAdmin
        .from("consent_forms")
        .update({
          current_version_id: data.id,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("organisation_id", context.organisation_id)
        .eq("id", form.id);

      const { error: updateError } = await updateQuery;

      if (updateError) return fail(updateError.message, 500);
    }

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create consent version", 400);
  }
}