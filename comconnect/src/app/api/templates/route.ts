import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function isSuperadmin(req: NextRequest) {
  const expectedKey = process.env.TEMPLATE_SUPERADMIN_KEY;
  const providedKey = req.headers.get("x-template-admin-key");

  if (!expectedKey) return false;
  return providedKey === expectedKey;
}

export async function GET(req: NextRequest) {
  const templateType = req.nextUrl.searchParams.get("template_type");
  const includeArchived = req.nextUrl.searchParams.get("include_archived");

  let query = supabaseAdmin
    .from("upload_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (templateType) {
    query = query.eq("template_type", templateType);
  }

  if (includeArchived !== "true") {
    query = query.eq("is_active", true).eq("status", "active");
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function PATCH(req: NextRequest) {
  if (!isSuperadmin(req)) {
    return fail("Only superadmin can update templates.", 403);
  }

  const body = await req.json().catch(() => null);

  const id = String(body?.id ?? "").trim();
  const action = String(body?.action ?? "").trim();

  if (!id) return fail("Template id is required.", 400);

  if (!["archive", "activate"].includes(action)) {
    return fail("Unsupported template action.", 400);
  }

  const payload =
    action === "archive"
      ? {
          status: "archived",
          is_active: false,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          status: "active",
          is_active: true,
          archived_at: null,
          updated_at: new Date().toISOString(),
        };

  const { data, error } = await supabaseAdmin
    .from("upload_templates")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  return ok(data);
}