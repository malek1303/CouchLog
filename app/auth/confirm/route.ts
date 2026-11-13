import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  // Default recovery links to /reset-password if next was stripped by Supabase redirect matching
  const rawNext = nextParam ?? (type === 'recovery' ? '/reset-password' : '/home');
  // Prevent open redirects by enforcing a relative path starting with a single '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home';

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');
  redirectTo.searchParams.delete('code');
  redirectTo.searchParams.delete('next');

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  // Redirect the user to login with error details if verification fails
  redirectTo.pathname = '/login';
  redirectTo.searchParams.set('error', 'Could not verify your email. The link may have expired or is invalid.');
  return NextResponse.redirect(redirectTo);
}
