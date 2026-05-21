'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tv, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === 'register') {
      const redirectTo = `${window.location.origin}/auth/confirm`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Account created! Check your email to confirm, then log in.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/search');
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(var(--color-bg))' }}>
      {/* Background glow */}
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
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: `hsl(var(--color-brand) / 0.15)`, border: `1px solid hsl(var(--color-brand) / 0.3)` }}
          >
            <Tv size={28} style={{ color: `hsl(var(--color-brand))` }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ letterSpacing: '-0.03em' }}>
            CouchLog
          </h1>
          <p className="text-muted mt-1">
            {mode === 'login' ? 'Welcome back. Sign in to continue.' : 'Start tracking your shows and movies.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-8" style={{ borderRadius: '1.25rem' }}>
          <h2 className="text-xl font-semibold mb-6">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>

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
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--color-text-subtle))' }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'hsl(var(--color-text-subtle))' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error / Success messages */}
            {error && (
              <div
                className="text-sm p-3 rounded-lg"
                style={{ background: 'hsl(var(--color-error) / 0.1)', color: 'hsl(var(--color-error))', border: '1px solid hsl(var(--color-error) / 0.2)' }}
                role="alert"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="text-sm p-3 rounded-lg"
                style={{ background: 'hsl(var(--color-success) / 0.1)', color: 'hsl(var(--color-success))', border: '1px solid hsl(var(--color-success) / 0.2)' }}
                role="status"
              >
                {success}
              </div>
            )}

            <button
              id={mode === 'login' ? 'login-submit' : 'register-submit'}
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2"
              style={{ height: '2.875rem' }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="divider" />

          <p className="text-center text-sm" style={{ color: 'hsl(var(--color-text-muted))' }}>
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold" style={{ color: 'hsl(var(--color-brand))' }}>
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-semibold" style={{ color: 'hsl(var(--color-brand))' }}>
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
