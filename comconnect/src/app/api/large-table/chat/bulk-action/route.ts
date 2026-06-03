import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { bulkUpdateTable } from "@/lib/large-table/bulk";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const result = await bulkUpdateTable("chat_threads", body);
    return ok(result);
  } catch (error: any) {
    return fail(error.message ?? "Bulk action failed", 400);
  }
}
