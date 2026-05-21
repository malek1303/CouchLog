import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/check-email
 * Checks if an email is already registered by querying auth.users schema using the service role.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid email' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const targetEmail = email.trim().toLowerCase();

    // 1. Try using the secure RPC function (preferred, handles large userbases)
    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        p_email: targetEmail
      });

      if (!error && typeof data === 'boolean') {
        return NextResponse.json({ exists: data });
      }
      
      // Log the RPC error to help debug but don't fail yet, try fallback
      console.warn('[Check Email] RPC check failed or not found, falling back to Admin API:', error);
    } catch (rpcErr) {
      console.warn('[Check Email] RPC error caught, falling back to Admin API:', rpcErr);
    }

    // 2. Fallback to Admin List Users API (works out-of-the-box, fine for small userbases)
    const { data, error } = await supabase.auth.admin.listUsers({
      perPage: 1000
    });

    if (error) {
      console.error('[Check Email Fallback Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const emailExists = data.users.some(
      (user) => user.email?.toLowerCase() === targetEmail
    );

    return NextResponse.json({ exists: emailExists });
  } catch (err: any) {
    console.error('[Check Email Handler Catch]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
