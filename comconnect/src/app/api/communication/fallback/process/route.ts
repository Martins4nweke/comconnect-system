import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { requireCronSecret } from "@/lib/communication/provider-config";
import { processDueCommunication } from "@/lib/communication/send-due";

export async function POST(req: NextRequest) {
  const allowed = requireCronSecret(req);
  if (!allowed.ok) return fail(allowed.error, 401);

  try {
    const result = await processDueCommunication();
    return ok(result);
  } catch (error: any) {
    return fail(error.message ?? "Fallback processing failed", 500);
  }
}
