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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return fail("Project not found", 404);

  return ok(data);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await req.json().catch(() => null);

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body?.name !== undefined) {
    const name = cleanText(body.name);
    if (!name) return fail("Project name cannot be empty", 400);
    updatePayload.name = name;
  }

  if (body?.project_code !== undefined) {
    const projectCode = normaliseProjectCode(body.project_code);
    if (!projectCode) return fail("Project code cannot be empty", 400);
    updatePayload.project_code = projectCode;
  }

  if (body?.description !== undefined) {
    updatePayload.description = cleanText(body.description) || null;
  }

  if (body?.status !== undefined) {
    updatePayload.status = cleanText(body.status) || "active";
  }

  if (body?.default_language !== undefined) {
    updatePayload.default_language = cleanText(body.default_language) || "en";
  }

  if (body?.app_access_enabled !== undefined) {
    updatePayload.app_access_enabled = Boolean(body.app_access_enabled);
  }

  if (body?.settings !== undefined) {
    updatePayload.settings = body.settings ?? {};
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok(data);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok({
    archived: true,
    project: data,
  });
}