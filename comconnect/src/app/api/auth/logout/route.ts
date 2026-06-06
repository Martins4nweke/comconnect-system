import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    redirectTo: "/login",
  });
}