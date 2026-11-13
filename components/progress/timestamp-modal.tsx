'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Check } from 'lucide-react';

export interface SeasonOption {
  season_number: number;
  episode_count: number;
  name?: string;
}

interface TimestampModalProps {
  current: string;
  label: string;
  isTv?: boolean;
  currentSeason?: number;
  currentEpisode?: number;
  seasons?: SeasonOption[];
  onClose: () => void;
  onSave: (timestamp: string, season?: number, episode?: number) => void | Promise<void>;
}

const subscribeNoop = () => () => {};

function parseTimestamp(ts: string) {
  if (!ts) return { hours: 0, minutes: 0, seconds: 0 };
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) {
    return { hours: parts[0] || 0, minutes: parts[1] || 0, seconds: parts[2] || 0 };
  } else if (parts.length === 2) {
    return { hours: 0, minutes: parts[0] || 0, seconds: parts[1] || 0 };
  }
  return { hours: 0, minutes: 0, seconds: 0 };
}

function formatTimestamp(h: number, m: number, s: number) {
  const pad = (num: number) => String(num).padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export default function TimestampModal({
  current,
  label,
  isTv = false,
  currentSeason = 1,
  currentEpisode = 1,
  seasons,
  onClose,
  onSave,
}: TimestampModalProps) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const initialTime = parseTimestamp(current);

  const [hours, setHours] = useState(initialTime.hours);
  const [minutes, setMinutes] = useState(initialTime.minutes);
  const [seconds, setSeconds] = useState(initialTime.seconds);

  const availableSeasons = seasons && seasons.length > 0 ? seasons : null;
  const initialSeason =
    availableSeasons && !availableSeasons.some((s) => s.season_number === currentSeason)
      ? availableSeasons[0].season_number
      : currentSeason;

  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(currentEpisode);
  const [saving, setSaving] = useState(false);

  const selectedSeasonObj = availableSeasons?.find((s) => s.season_number === season);
  const maxEpisodes = selectedSeasonObj ? Math.max(1, selectedSeasonObj.episode_count) : 100;
  const clampedEpisode = Math.min(Math.max(1, episode), maxEpisodes);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleSeasonChange(nextSeason: number) {
    setSeason(nextSeason);
    const nextSeasonObj = availableSeasons?.find((s) => s.season_number === nextSeason);
    const nextMax = nextSeasonObj ? Math.max(1, nextSeasonObj.episode_count) : 100;
    if (episode > nextMax) {
      setEpisode(nextMax);
    }
  }

  async function handleSave() {
    setSaving(true);
    const ts = formatTimestamp(hours, minutes, seconds);
    // If it is 0:00, treat it as cleared
    const finalTs = hours === 0 && minutes === 0 && seconds === 0 ? '' : ts;
    await onSave(finalTs, isTv ? season : undefined, isTv ? clampedEpisode : undefined);
    setSaving(false);
  }

  async function handleClear() {
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    setSaving(true);
    await onSave('', isTv ? season : undefined, isTv ? clampedEpisode : undefined);
    setSaving(false);
  }

  return mounted ? createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'hsl(224 15% 4% / 0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="card animate-slide-up w-full max-w-md p-5 sm:p-7"
        style={{ borderRadius: '1.25rem' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Update tracking progress"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} style={{ color: 'hsl(var(--color-brand))' }} />
              <h3 className="text-base font-semibold">Update Progress</h3>
            </div>
            <p className="text-xs text-muted truncate">{label}</p>
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

        {/* TV Tracking: Season & Episode selects */}
        {isTv && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                Season
              </label>
              <select
                value={season}
                onChange={(e) => handleSeasonChange(Number(e.target.value))}
                className="w-full text-sm rounded-xl p-2"
                style={{
                  background: 'hsl(var(--color-surface-2))',
                  border: '1px solid hsl(var(--color-border))',
                  color: 'hsl(var(--color-text))',
                }}
              >
                {availableSeasons
                  ? availableSeasons.map((s) => (
                      <option key={s.season_number} value={s.season_number}>
                        Season {s.season_number}
                      </option>
                    ))
                  : Array.from({ length: 20 }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>
                        Season {s}
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'hsl(var(--color-text-muted))' }}>
                Episode
              </label>
              <select
                value={clampedEpisode}
                onChange={(e) => setEpisode(Number(e.target.value))}
                className="w-full text-sm rounded-xl p-2"
                style={{
                  background: 'hsl(var(--color-surface-2))',
                  border: '1px solid hsl(var(--color-border))',
                  color: 'hsl(var(--color-text))',
                }}
              >
                {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((ep) => (
                  <option key={ep} value={ep}>
                    Episode {ep}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Time Picker */}
        <div className="mb-5">
          <label className="block text-xs font-semibold mb-2" style={{ color: 'hsl(var(--color-text-muted))' }}>
            Where did you pause? (Hours / Minutes / Seconds)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Hours Select */}
            <div>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full text-sm rounded-xl p-2.5 text-center"
                style={{
                  background: 'hsl(var(--color-surface-2))',
                  border: '1px solid hsl(var(--color-border))',
                  color: 'hsl(var(--color-text))',
                }}
              >
                {Array.from({ length: 10 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {h} hr
                  </option>
                ))}
              </select>
            </div>

            {/* Minutes Select */}
            <div>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full text-sm rounded-xl p-2.5 text-center"
                style={{
                  background: 'hsl(var(--color-surface-2))',
                  border: '1px solid hsl(var(--color-border))',
                  color: 'hsl(var(--color-text))',
                }}
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} min
                  </option>
                ))}
              </select>
            </div>

            {/* Seconds Select */}
            <div>
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="w-full text-sm rounded-xl p-2.5 text-center"
                style={{
                  background: 'hsl(var(--color-surface-2))',
                  border: '1px solid hsl(var(--color-border))',
                  color: 'hsl(var(--color-text))',
                }}
              >
                {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                  <option key={s} value={s}>
                    {String(s).padStart(2, '0')} sec
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] mt-2 text-subtle">
            Select a custom paused timestamp. Clearing sets the timestamp to null.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          {current && (
            <button onClick={handleClear} disabled={saving} className="btn btn-ghost flex-1 text-sm rounded-xl py-2.5">
              Clear
            </button>
          )}
          <button
            id="timestamp-save"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex-1 text-sm rounded-xl py-2.5"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : (
              <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Save</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
