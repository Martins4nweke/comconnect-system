import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isAuthorised(req: NextRequest) {
  const expectedSecret = cleanText(process.env.COMCONNECT_CRON_SECRET);

  if (!expectedSecret) {
    return {
      ok: false,
      error: "COMCONNECT_CRON_SECRET is not configured.",
    };
  }

  const url = new URL(req.url);

  const headerSecret =
    cleanText(req.headers.get("x-comconnect-cron-secret")) ||
    cleanText(req.headers.get("x-cron-secret"));

  const querySecret = cleanText(url.searchParams.get("secret"));

  const suppliedSecret = headerSecret || querySecret;

  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    return {
      ok: false,
      error: "Unauthorised heartbeat request.",
    };
  }

  return {
    ok: true,
    error: "",
  };
}

async function writeHeartbeat(source: string) {
  const heartbeatKey = "comconnect_primary";
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await supabaseAdmin
    .from("system_heartbeat")
    .select("heartbeat_key, run_count")
    .eq("heartbeat_key", heartbeatKey)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const nextRunCount = Number(existing?.run_count ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("system_heartbeat")
    .upsert(
      {
        heartbeat_key: heartbeatKey,
        last_ping_at: now,
        source,
        status: "ok",
        run_count: nextRunCount,
        metadata: {
          app: "ComConnect",
          purpose: "external_cron_heartbeat",
          safe: true,
          sends_messages: false,
        },
        updated_at: now,
      },
      {
        onConflict: "heartbeat_key",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function GET(req: NextRequest) {
  try {
    const auth = isAuthorised(req);

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        { status: auth.error.includes("configured") ? 500 : 401 }
      );
    }

    const url = new URL(req.url);
    const source =
      cleanText(url.searchParams.get("source")) || "external_cron_get";

    const heartbeat = await writeHeartbeat(source);

    return NextResponse.json({
      ok: true,
      message: "ComConnect heartbeat completed.",
      data: heartbeat,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Heartbeat failed.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = isAuthorised(req);

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        { status: auth.error.includes("configured") ? 500 : 401 }
      );
    }

    const heartbeat = await writeHeartbeat("external_cron_post");

    return NextResponse.json({
      ok: true,
      message: "ComConnect heartbeat completed.",
      data: heartbeat,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Heartbeat failed.",
      },
      { status: 500 }
    );
  }
}