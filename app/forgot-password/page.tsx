'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tv, Mail, Loader2, AlertTriangle, Check, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Check your email for the password reset link.');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(var(--color-bg))' }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% -10%, hsl(var(--color-brand) / 0.12), transparent)`,
        }}
      />

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 transition-all duration-300 hover:scale-105"
            style={{
              background: `hsl(var(--color-brand) / 0.15)`,
              border: `1px solid hsl(var(--color-brand) / 0.3)`
            }}
          >
            <Tv size={28} style={{ color: `hsl(var(--color-brand))` }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ letterSpacing: '-0.03em' }}>
            CouchLog
          </h1>
          <p className="text-muted mt-1">
            Reset your password
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 relative overflow-hidden" style={{ borderRadius: '1.25rem' }}>
          <h2 className="text-xl font-semibold mb-2">Forgot Password</h2>
          <p className="text-sm text-subtle mb-6">Enter your email address and we'll send you a link to reset your password.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--color-text-subtle))' }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    paddingLeft: '2.5rem',
                  }}
                />
              </div>
            </div>

            {/* Error / Success messages */}
            {error && (
              <div
                className="text-sm p-3 rounded-lg flex items-start gap-1.5 animate-slide-up"
                style={{ background: 'hsl(var(--color-error) / 0.1)', color: 'hsl(var(--color-error))', border: '1px solid hsl(var(--color-error) / 0.2)' }}
                role="alert"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div
                className="text-sm p-3 rounded-lg flex items-start gap-1.5 animate-slide-up"
                style={{ background: 'hsl(var(--color-success) / 0.1)', color: 'hsl(var(--color-success))', border: '1px solid hsl(var(--color-success) / 0.2)' }}
                role="status"
              >
                <Check size={16} className="shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success !== null}
              className="btn btn-primary w-full mt-2"
              style={{ height: '2.875rem' }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="divider" />

          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: 'hsl(var(--color-text-muted))' }}>
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
