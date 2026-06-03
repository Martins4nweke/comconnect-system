import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { queuePushForParticipant } from "@/lib/communication/fallback-engine";

function checkOptionalSecret(req: NextRequest) {
  const expected = process.env.COMCONNECT_CRON_SECRET;
  if (!expected) return { ok: true };
  const received = req.headers.get("x-comconnect-cron-secret");
  if (received !== expected) {
    return { ok: false, error: "Invalid communication API secret" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const allowed = checkOptionalSecret(req);
  if (!allowed.ok) return fail(allowed.error, 401);

  const body = await req.json().catch(() => null);

  if (!body?.project_id) return fail("project_id is required");
  if (!body?.participant_id) return fail("participant_id is required");

  try {
    const queued = await queuePushForParticipant({
      project_id: body.project_id,
      participant_id: body.participant_id,
      title: body.title ?? "ComConnect",
      body: body.body ?? "You have a new ComConnect update.",
      data: body.data ?? {},
      scheduled_for: body.scheduled_for ?? null,
    });

    return ok(queued, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to queue push", 400);
  }
}
