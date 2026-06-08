import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicApiRoute(pathname: string) {
  return (
    pathname === "/api/cron/send-due" ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/heartbeat" ||
    pathname.startsWith("/api/heartbeat") ||
    pathname === "/api/communication/send-due" ||
    pathname === "/api/scheduler/run-due" ||
    pathname === "/api/communication/fallback/process" ||
    pathname === "/api/communication/health" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/communication/africastalking/") ||
    pathname.startsWith("/api/external/")
  );
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
  }

  let response = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  const publicPaths = ["/", "/login", "/signup", "/pricing"];

  const isPublicPath =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/participant-app") ||
    pathname.startsWith("/api/auth") ||
    isPublicApiRoute(pathname);

  /*
    Important:
    Public API routes are not browser pages. They should not be redirected
    to /login. Routes like /api/cron/send-due and /api/communication/send-due
    are still protected by their own cron secret header.
  */
  if (isPublicApiRoute(pathname)) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);

    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}