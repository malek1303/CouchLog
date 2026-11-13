import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const GUEST_ONLY_ROUTES = ['/login', '/register', '/forgot-password'];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Redirect legacy /search route to /home
  if (pathname === '/search') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // If Supabase redirects with a recovery/auth code or token_hash to another route,
  // forward it to /auth/confirm so token/code exchange executes cleanly.
  if (
    !pathname.startsWith('/auth/confirm') &&
    (searchParams.has('code') || (searchParams.has('token_hash') && searchParams.has('type')))
  ) {
    const confirmUrl = request.nextUrl.clone();
    confirmUrl.pathname = '/auth/confirm';
    if (!confirmUrl.searchParams.has('next') && pathname !== '/') {
      confirmUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(confirmUrl);
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Always allow /auth/confirm through so OTP/PKCE verification can run regardless of existing session
  if (pathname.startsWith('/auth/confirm')) {
    return supabaseResponse;
  }

  // /reset-password requires an active (recovery) session; never redirect logged-in users away from it
  if (pathname.startsWith('/reset-password')) {
    if (!user) {
      return NextResponse.redirect(new URL('/forgot-password', request.url));
    }
    return supabaseResponse;
  }

  // Guest-only routes — redirect already-authenticated users to /home
  if (GUEST_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
    return supabaseResponse;
  }

  // Protected routes — redirect to /login if not authenticated
  if (!user && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|placeholder-poster.png).*)',
  ],
};
