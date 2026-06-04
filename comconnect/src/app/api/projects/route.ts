import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseProjectCode(value: unknown) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const organisationId = cleanText(url.searchParams.get("organisation_id"));
  const status = cleanText(url.searchParams.get("status"));
  const q = cleanText(url.searchParams.get("q"));

  let query = supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,project_code.ilike.%${q}%,description.ilike.%${q}%`
    );
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok({
    rows: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const organisationId = cleanText(body?.organisation_id);
  const name = cleanText(body?.name);
  const projectCode = normaliseProjectCode(body?.project_code || name);
  const description = cleanText(body?.description);
  const defaultLanguage = cleanText(body?.default_language) || "en";
  const appAccessEnabled = Boolean(body?.app_access_enabled ?? true);

  if (!organisationId) {
    return fail("organisation_id is required", 400);
  }

  if (!name) {
    return fail("Project name is required", 400);
  }

  if (!projectCode) {
    return fail("Project code is required", 400);
  }

  const { data: existingProject, error: existingError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("project_code", projectCode)
    .maybeSingle();

  if (existingError) {
    return fail(existingError.message, 500);
  }

  if (existingProject) {
    return fail("A project with this project_code already exists in this organisation", 409);
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      organisation_id: organisationId,
      name,
      project_code: projectCode,
      description: description || null,
      status: "active",
      default_language: defaultLanguage,
      app_access_enabled: appAccessEnabled,
      settings: body?.settings ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok(data, 201);
}