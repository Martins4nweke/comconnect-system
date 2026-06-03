/**
 * Placeholder guard for Phase 1 API routes.
 *
 * This starter pack uses Supabase service role server-side, so you should protect
 * these routes with your existing app authentication/middleware before production.
 *
 * Suggested production rule:
 * - Only authenticated dashboard users can call dashboard/core APIs.
 * - Enforce organisation/project membership before returning data.
 * - External API clients should use scoped API keys in a separate /api/v1 layer.
 */
export function assertCoreApiConfiguredForDevelopment() {
  if (process.env.NODE_ENV === "production" && process.env.COMCONNECT_CORE_API_PROTECTED !== "true") {
    console.warn(
      "ComConnect core API routes need production auth protection. Set COMCONNECT_CORE_API_PROTECTED=true after adding middleware/guards."
    );
  }
}
