import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { processDueCommunication } from "@/lib/communication/send-due";

export async function POST(_req: NextRequest) {
  try {
    const result = await processDueCommunication();
    return ok(result);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to process due communication", 500);
  }
}