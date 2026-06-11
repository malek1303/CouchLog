'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Tv, Lock, Loader2, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react';

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
  let color = 'hsl(var(--color-error))';
  if (score === 2) {
    label = 'Fair';
    color = 'hsl(var(--color-warning))';
  } else if (score === 3) {
    label = 'Good';
    color = 'hsl(var(--color-info))';
  } else if (score === 4) {
    label = 'Strong';
    color = 'hsl(var(--color-success))';
  }

  return { score, label, color, checks };
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/home');
      router.refresh();
    }
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
            Choose a new password
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 relative overflow-hidden" style={{ borderRadius: '1.25rem' }}>
          <h2 className="text-xl font-semibold mb-6">Reset Password</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                New Password
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
              {password.length > 0 && (() => {
                const { score, label, color, checks } = getPasswordStrength(password);
                return (
                  <div className="mt-3 space-y-2 animate-slide-up">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Password Strength:</span>
                      <span className="font-semibold" style={{ color }}>{label}</span>
                    </div>
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

            {/* Confirm Password */}
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

            {/* Error message */}
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

            <button
              type="submit"
              disabled={loading || (confirmPassword.length > 0 && password !== confirmPassword)}
              className="btn btn-primary w-full mt-2"
              style={{ height: '2.875rem' }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
