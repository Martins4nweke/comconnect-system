import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
]);

function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-comconnect-cron-secret",
    "Access-Control-Max-Age": "86400",
  };
}

export function proxy(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = NextResponse.next();

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: "/api/:path*",
};