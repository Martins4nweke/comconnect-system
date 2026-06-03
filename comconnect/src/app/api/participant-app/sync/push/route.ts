import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { handleSyncPushItem, recordSyncEvent } from "@/lib/participant-app/sync";
import type { SyncPushItem } from "@/lib/participant-app/types";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);
  const items = body?.items;

  if (!Array.isArray(items)) {
    return fail("items array is required");
  }

  if (items.length > 100) {
    return fail("A maximum of 100 sync items can be pushed at once", 413);
  }

  const results = [];
  let failed = 0;

  for (const item of items as SyncPushItem[]) {
    if (!item?.local_id || !item?.type || String(item.local_id).length > 120) {
      failed += 1;
      results.push({
        local_id: item?.local_id ?? null,
        status: "failed",
        error: "local_id and type are required, and local_id must be 120 characters or fewer",
      });
      continue;
    }

    try {
      const result = await handleSyncPushItem(auth.context, item);
      results.push(result);
    } catch (error: any) {
      failed += 1;
      results.push({
        local_id: item.local_id,
        type: item.type,
        status: "failed",
        error: error.message ?? "Failed to sync item",
      });
    }
  }

  const status = failed === 0 ? "success" : failed === items.length ? "failed" : "partial";

  await recordSyncEvent(auth.context, "push", items.length, status, {
    failed,
    success: items.length - failed,
  });

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "participant_app.sync_push",
    entity_type: "participant",
    entity_id: auth.context.participant_id,
    metadata: {
      item_count: items.length,
      failed,
      status,
    },
  });

  return ok({
    status,
    received: items.length,
    synced: items.length - failed,
    failed,
    results,
    server_time: new Date().toISOString(),
  });
}
