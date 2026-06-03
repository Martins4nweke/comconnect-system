import { supabaseAdmin } from "@/lib/supabase/admin";

export function normaliseParticipantPhone(value: unknown) {
  return String(value ?? "")
    .replace(/[\s()\-]/g, "")
    .trim();
}

export async function hasTooManyRecentLoginFailures(input: {
  project_code: string;
  participant_code: string;
  phone_number: string;
  window_minutes?: number;
  max_failures?: number;
}) {
  const windowMinutes = input.window_minutes ?? 15;
  const maxFailures = input.max_failures ?? 8;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("participant_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("project_code", input.project_code)
    .eq("participant_code", input.participant_code)
    .eq("phone_number", input.phone_number)
    .eq("success", false)
    .gte("created_at", since);

  if (error) {
    console.error("Login rate-limit check failed:", error.message);
    return false;
  }

  return (count ?? 0) >= maxFailures;
}
