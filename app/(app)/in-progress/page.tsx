'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, Loader2, CheckCircle2, Film, Tv } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EpisodeProgress, MovieProgress, Media } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import TimestampModal from '@/components/progress/timestamp-modal';

interface InProgressEpisode extends EpisodeProgress {
  media: Media;
}
interface InProgressMovie extends MovieProgress {
  media: Media;
}

export default function InProgressPage() {
  const [episodes, setEpisodes] = useState<InProgressEpisode[]>([]);
  const [movies, setMovies] = useState<InProgressMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [epRes, movRes] = await Promise.all([
        supabase
          .from('episode_progress')
          .select('*, media(*)')
          .eq('user_id', user.id)
          .eq('watched', false)
          .not('stopped_at_timestamp', 'is', null)
          .order('updated_at', { ascending: false }),
        supabase
          .from('movie_progress')
          .select('*, media(*)')
          .eq('user_id', user.id)
          .eq('watched', false)
          .not('stopped_at_timestamp', 'is', null)
          .order('updated_at', { ascending: false }),
      ]);

      setEpisodes((epRes.data as InProgressEpisode[]) ?? []);
      setMovies((movRes.data as InProgressMovie[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function markEpisodeWatched(ep: InProgressEpisode) {
    await supabase
      .from('episode_progress')
      .update({ watched: true, watched_at: new Date().toISOString(), stopped_at_timestamp: null })
      .eq('id', ep.id);
    setEpisodes((prev) => prev.filter((e) => e.id !== ep.id));
  }

  async function markMovieWatched(mv: InProgressMovie) {
    await supabase
      .from('movie_progress')
      .update({ watched: true, watched_at: new Date().toISOString(), stopped_at_timestamp: null })
      .eq('id', mv.id);
    setMovies((prev) => prev.filter((m) => m.id !== mv.id));
  }

  async function updateEpisodeTimestamp(ep: InProgressEpisode, ts: string) {
    await supabase
      .from('episode_progress')
      .update({ stopped_at_timestamp: ts || null })
      .eq('id', ep.id);
    if (!ts) setEpisodes((prev) => prev.filter((e) => e.id !== ep.id));
    else setEpisodes((prev) => prev.map((e) => e.id === ep.id ? { ...e, stopped_at_timestamp: ts } : e));
  }

  async function updateMovieTimestamp(mv: InProgressMovie, ts: string) {
    await supabase
      .from('movie_progress')
      .update({ stopped_at_timestamp: ts || null })
      .eq('id', mv.id);
    if (!ts) setMovies((prev) => prev.filter((m) => m.id !== mv.id));
    else setMovies((prev) => prev.map((m) => m.id === mv.id ? { ...m, stopped_at_timestamp: ts } : m));
  }

  const total = episodes.length + movies.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--color-brand))' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="mb-1">In Progress</h1>
        <p className="text-muted">
          {total === 0 ? 'Nothing paused right now.' : `${total} item${total !== 1 ? 's' : ''} with a saved timestamp.`}
        </p>
      </div>

      {total === 0 ? (
        <div className="text-center py-20">
          <Clock size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">Nothing in progress</p>
          <p className="text-subtle text-sm mt-1">Set a timestamp on an episode or movie to track where you paused.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {episodes.map((ep) => (
            <InProgressCard
              key={ep.id}
              title={ep.media.title}
              posterPath={ep.media.poster_path}
              mediaType="tv"
              subtitle={`Season ${ep.season_number}, Episode ${ep.episode_number}`}
              timestamp={ep.stopped_at_timestamp!}
              onMarkWatched={() => markEpisodeWatched(ep)}
              onTimestampUpdate={(ts) => updateEpisodeTimestamp(ep, ts)}
              timestampLabel={`S${ep.season_number}E${ep.episode_number} — ${ep.media.title}`}
            />
          ))}
          {movies.map((mv) => (
            <InProgressCard
              key={mv.id}
              title={mv.media.title}
              posterPath={mv.media.poster_path}
              mediaType="movie"
              timestamp={mv.stopped_at_timestamp!}
              onMarkWatched={() => markMovieWatched(mv)}
              onTimestampUpdate={(ts) => updateMovieTimestamp(mv, ts)}
              timestampLabel={mv.media.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── InProgressCard ─────────────────────────────────────────────
function InProgressCard({
  title, posterPath, mediaType, subtitle, timestamp,
  onMarkWatched, onTimestampUpdate, timestampLabel,
}: {
  title: string;
  posterPath: string | null;
  mediaType: 'tv' | 'movie';
  subtitle?: string;
  timestamp: string;
  onMarkWatched: () => void;
  onTimestampUpdate: (ts: string) => void | Promise<void>;
  timestampLabel: string;
}) {
  const [showTimestamp, setShowTimestamp] = useState(false);

  return (
    <div className="card flex gap-4 p-4 animate-slide-up">
      {/* Poster */}
      <div className="relative flex-shrink-0" style={{ width: 64, height: 96, borderRadius: '0.5rem', overflow: 'hidden' }}>
        {posterPath ? (
          <Image
            src={posterUrl(posterPath, 'w185')}
            alt={title}
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--color-surface-2))' }}>
            {mediaType === 'tv' ? <Tv size={22} style={{ color: 'hsl(var(--color-border))' }} /> : <Film size={22} style={{ color: 'hsl(var(--color-border))' }} />}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{title}</p>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}

        {/* Timestamp chip */}
        <div
          className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-sm font-medium"
          style={{ background: 'hsl(var(--color-accent) / 0.12)', color: 'hsl(var(--color-accent))' }}
        >
          <Clock size={13} />
          Paused at {timestamp}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowTimestamp(true)}
            className="btn btn-ghost text-xs"
            style={{ padding: '0.35rem 0.75rem' }}
          >
            <Clock size={13} />
            Update
          </button>
          <button
            onClick={onMarkWatched}
            className="btn text-xs"
            style={{
              padding: '0.35rem 0.75rem',
              background: 'hsl(var(--color-success) / 0.15)',
              color: 'hsl(var(--color-success))',
              border: '1px solid hsl(var(--color-success) / 0.3)',
            }}
          >
            <CheckCircle2 size={13} />
            Mark Watched
          </button>
        </div>
      </div>

      {showTimestamp && (
        <TimestampModal
          current={timestamp}
          label={timestampLabel}
          onClose={() => setShowTimestamp(false)}
          onSave={async (ts) => {
            await onTimestampUpdate(ts);
            setShowTimestamp(false);
          }}
        />
      )}
    </div>
  );
}
