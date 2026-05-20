'use client';

import { useEffect, useRef } from 'react';
import { X, Clock, Check } from 'lucide-react';
import { useState } from 'react';

interface TimestampModalProps {
  current: string;
  label: string;
  onClose: () => void;
  onSave: (timestamp: string) => void | Promise<void>;
}

const HH_MM_SS_REGEX = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/;

export default function TimestampModal({ current, label, onClose, onSave }: TimestampModalProps) {
  const [value, setValue] = useState(current ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function validate(v: string): boolean {
    if (!v) return true; // empty = clear timestamp, valid
    if (!HH_MM_SS_REGEX.test(v)) {
      setError('Use format MM:SS or HH:MM:SS (e.g. 42:30 or 1:02:45)');
      return false;
    }
    setError('');
    return true;
  }

  async function handleSave() {
    if (!validate(value)) return;
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
  }

  async function handleClear() {
    setValue('');
    setSaving(true);
    await onSave('');
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'hsl(224 15% 4% / 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="card animate-slide-up w-full max-w-md"
        style={{ padding: '1.75rem', borderRadius: '1.25rem' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Set paused timestamp"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} style={{ color: 'hsl(var(--color-brand))' }} />
              <h3 className="text-base font-semibold">Set Timestamp</h3>
            </div>
            <p className="text-xs text-muted truncate max-w-xs">{label}</p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost p-1.5 flex-shrink-0"
            style={{ borderRadius: '0.5rem', minWidth: 0 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--color-text-muted))' }}>
            Where did you pause?
          </label>
          <input
            ref={inputRef}
            id="timestamp-input"
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) validate(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder="e.g. 42:30 or 1:02:45"
          />
          {error && (
            <p className="text-xs mt-1.5" style={{ color: 'hsl(var(--color-error))' }}>{error}</p>
          )}
          <p className="text-xs mt-1.5 text-subtle">
            Format: <code>MM:SS</code> or <code>HH:MM:SS</code> — leave blank to clear.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {current && (
            <button onClick={handleClear} disabled={saving} className="btn btn-ghost flex-1 text-sm">
              Clear
            </button>
          )}
          <button
            id="timestamp-save"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex-1 text-sm"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check size={14} /> Save</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
