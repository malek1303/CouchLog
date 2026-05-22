'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tv, Mail, Lock, Loader2, Eye, EyeOff, Check, AlertTriangle, Sparkles } from 'lucide-react';

interface AuthFormProps {
  mode: 'login' | 'register';
}

function getPasswordStrength(pwd: string) {
  if (!pwd) return { score: 0, label: '', color: 'transparent', checks: [] };

  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const isLongEnough = pwd.length >= 8;

  const checks = [
    { label: 'At least 8 characters', met: isLongEnough },
    { label: 'Uppercase & lowercase', met: hasUpper && hasLower },
    { label: 'At least one number', met: hasDigit },
    { label: 'At least one special char', met: hasSpecial },
  ];

  const score = checks.filter(c => c.met).length;

  let label = 'Weak';
  let color = 'hsl(var(--color-error))'; // Red
  if (score === 2) {
    label = 'Fair';
    color = 'hsl(var(--color-warning))'; // Orange
  } else if (score === 3) {
    label = 'Good';
    color = 'hsl(var(--color-info))'; // Cyan/Blue
  } else if (score === 4) {
    label = 'Strong';
    color = 'hsl(var(--color-success))'; // Green
  }

  return { score, label, color, checks };
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Debounced email duplicate check
  useEffect(() => {
    const isEmailValid = (emailStr: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
    };

    if (mode !== 'register' || !email || !isEmailValid(email)) {
      setEmailExists(false);
      return;
    }

    setCheckingEmail(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.exists) {
          setEmailExists(true);
        } else {
          setEmailExists(false);
        }
      } catch (err) {
        console.error('Failed to check email availability:', err);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [email, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      // Double-check if the email already exists to prevent race conditions
      try {
        const checkRes = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const checkData = await checkRes.json();
        if (checkData.exists) {
          setEmailExists(true);
          setError('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to double-check email availability:', err);
      }

      if (emailExists) {
        setError('This email is already registered. Please sign in instead.');
        setLoading(false);
        return;
      }

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
        router.push('/home');
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(var(--color-bg))' }}>
      {/* Background glow - custom styling per page mode for visual clarity */}
      {mode === 'login' ? (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% -10%, hsl(var(--color-brand) / 0.12), transparent)`,
          }}
        />
      ) : (
        <>
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle 35% 30% at 85% 15%, hsl(var(--color-accent) / 0.08), transparent),
                           radial-gradient(circle 45% 40% at 15% 85%, hsl(var(--color-brand) / 0.08), transparent)`,
            }}
          />
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 60% 50% at 50% -10%, hsl(var(--color-brand) / 0.08), hsl(var(--color-accent) / 0.04), transparent)`,
            }}
          />
        </>
      )}

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          {mode === 'register' && (
            <span
              className="badge mb-3 animate-fade-in"
              style={{
                background: 'linear-gradient(90deg, hsl(var(--color-brand) / 0.12), hsl(var(--color-accent) / 0.12))',
                border: '1px solid hsl(var(--color-brand) / 0.2)',
                color: 'hsl(var(--color-text))',
                padding: '0.3em 0.8em',
                fontSize: '0.75rem',
                letterSpacing: '0.03em'
              }}
            >
              <Sparkles size={11} className="inline mr-1 text-accent animate-pulse" />
              Join CouchLog
            </span>
          )}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 transition-all duration-300 hover:scale-105"
            style={{
              background: mode === 'login'
                ? `hsl(var(--color-brand) / 0.15)`
                : `linear-gradient(135deg, hsl(var(--color-brand) / 0.2), hsl(var(--color-accent) / 0.2))`,
              border: mode === 'login'
                ? `1px solid hsl(var(--color-brand) / 0.3)`
                : `1px solid hsl(var(--color-accent) / 0.3)`
            }}
          >
            <Tv size={28} style={{ color: mode === 'login' ? `hsl(var(--color-brand))` : `hsl(var(--color-accent))` }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ letterSpacing: '-0.03em' }}>
            CouchLog
          </h1>
          <p className="text-muted mt-1">
            {mode === 'login' ? 'Welcome back. Sign in to continue.' : 'Start tracking your shows and movies.'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 relative overflow-hidden" style={{ borderRadius: '1.25rem' }}>
          {/* Subtle colored accent top border in register mode to distinguish it visually from sign in */}
          {mode === 'register' && (
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: 'linear-gradient(90deg, hsl(var(--color-brand)), hsl(var(--color-accent)))'
              }}
            />
          )}

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
                  style={{
                    paddingLeft: '2.5rem',
                    paddingRight: checkingEmail ? '2.5rem' : undefined,
                    borderColor: emailExists ? 'hsl(var(--color-error))' : undefined,
                  }}
                />
                {checkingEmail && (
                  <Loader2 size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--color-brand))' }} />
                )}
              </div>

              {/* Warning for already registered emails */}
              {emailExists && (
                <div
                  className="mt-2 text-xs flex items-start gap-1.5 p-2.5 rounded-lg border animate-slide-up"
                  style={{
                    background: 'hsl(var(--color-error) / 0.08)',
                    color: 'hsl(var(--color-error))',
                    borderColor: 'hsl(var(--color-error) / 0.15)',
                  }}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    This email is already registered. Please{' '}
                    <Link href="/login" className="underline font-semibold hover:text-[hsl(var(--color-accent))]">
                      sign in
                    </Link>{' '}
                    instead.
                  </span>
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                {mode === 'register' ? 'Choose Password' : 'Password'}
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

              {/* Password Strength Meter */}
              {mode === 'register' && password.length > 0 && (() => {
                const { score, label, color, checks } = getPasswordStrength(password);
                return (
                  <div className="mt-3 space-y-2 animate-slide-up">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Password Strength:</span>
                      <span className="font-semibold" style={{ color }}>{label}</span>
                    </div>

                    {/* 4 segments strength bar */}
                    <div className="flex gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className="flex-1 h-full rounded-full transition-all duration-300"
                          style={{
                            background: index <= score ? color : 'hsl(var(--color-border))',
                          }}
                        />
                      ))}
                    </div>

                    {/* Dynamic checklist requirements */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1.5 border-t" style={{ borderColor: 'hsl(var(--color-border) / 0.4)' }}>
                      {checks.map((check, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-[11px] transition-all">
                          {check.met ? (
                            <Check size={11} className="text-[hsl(var(--color-success))]" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full border border-dashed" style={{ borderColor: 'hsl(var(--color-text-subtle))' }} />
                          )}
                          <span style={{ color: check.met ? 'hsl(var(--color-text))' : 'hsl(var(--color-text-subtle))' }}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Confirm Password (only in register mode) */}
            {mode === 'register' && (
              <div className="animate-slide-up">
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--color-text-subtle))' }} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      paddingLeft: '2.5rem',
                      paddingRight: '2.75rem',
                      borderColor: confirmPassword.length > 0
                        ? (password === confirmPassword ? 'hsl(var(--color-success))' : 'hsl(var(--color-error))')
                        : undefined,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'hsl(var(--color-text-subtle))' }}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="mt-2 text-xs flex items-center gap-1.5 animate-slide-up">
                    {password === confirmPassword ? (
                      <>
                        <Check size={14} className="text-[hsl(var(--color-success))]" />
                        <span style={{ color: 'hsl(var(--color-success))' }}>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-[hsl(var(--color-error))]" />
                        <span style={{ color: 'hsl(var(--color-error))' }}>Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

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
              id={mode === 'login' ? 'login-submit' : 'register-submit'}
              type="submit"
              disabled={loading || (mode === 'register' && (emailExists || (confirmPassword.length > 0 && password !== confirmPassword)))}
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
                <Link href="/register" className="font-semibold text-brand" style={{ color: 'hsl(var(--color-brand))' }}>
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-brand" style={{ color: 'hsl(var(--color-brand))' }}>
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

