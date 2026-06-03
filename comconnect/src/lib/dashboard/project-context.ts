import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getProjectContext(projectId?: string | null) {
  if (!projectId) {
    return { project: null, organisation: null };
  }

  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, name, project_code, organisations(id, name)")
    .eq("id", projectId)
    .maybeSingle();

  return {
    project: data ?? null,
    organisation: data?.organisations ?? null,
  };
}

export async function getProjectIdFromSearchParams(searchParamsPromise?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined }) {
  const searchParams = await searchParamsPromise;
  const raw = searchParams?.project_id;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}
