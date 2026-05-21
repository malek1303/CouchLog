'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Clock, Loader2, CheckCircle2, Tv, Film } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Watchlist } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import TimestampModal from '@/components/progress/timestamp-modal';
import { useToast } from '@/hooks/use-toast';

export default function InProgressPage() {
  const [items, setItems] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const loadInProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('watchlist')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .eq('status', 'watching')
      .order('created_at', { ascending: false });

    setItems((data as Watchlist[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadInProgress();
  }, [loadInProgress]);

  async function updateProgress(item: Watchlist, season: number, episode: number, timestamp: string) {
    const { error } = await supabase
      .from('watchlist')
      .update({
        current_season: season,
        current_episode: episode,
        last_timestamp: timestamp || null,
      })
      .eq('id', item.id);

    if (error) {
      toast({ title: 'Error saving progress', description: error.message, variant: 'destructive' });
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, current_season: season, current_episode: episode, last_timestamp: timestamp || null }
          : i
      )
    );
    toast({ title: 'Progress updated!' });
  }

  async function markCompleted(item: Watchlist) {
    if (item.media?.media_type === 'tv') {
      // For TV shows: advance to the next episode and clear timestamp
      const nextEp = item.current_episode + 1;
      const { error } = await supabase
        .from('watchlist')
        .update({
          current_episode: nextEp,
          last_timestamp: null,
        })
        .eq('id', item.id);

      if (error) {
        toast({ title: 'Error updating episode', description: error.message, variant: 'destructive' });
        return;
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, current_episode: nextEp, last_timestamp: null }
            : i
        )
      );
      toast({ title: 'Episode marked as watched!', description: `Advanced to S${item.current_season}E${nextEp}.` });
    } else {
      // For Movies: mark status as completed and remove from In Progress view
      const { error } = await supabase
        .from('watchlist')
        .update({
          status: 'completed',
          last_timestamp: null,
        })
        .eq('id', item.id);

      if (error) {
        toast({ title: 'Error saving status', description: error.message, variant: 'destructive' });
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({ title: 'Movie marked as completed!' });
    }
  }

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
          {items.length === 0 ? 'Nothing in progress right now.' : `${items.length} show${items.length !== 1 ? 's' : ''} actively being tracked.`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">Nothing in progress</p>
          <p className="text-subtle text-sm mt-1">Start watching a show or movie from Search to track your progress here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <InProgressCard
              key={item.id}
              item={item}
              onProgressUpdate={updateProgress}
              onMarkCompleted={markCompleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── InProgressCard ─────────────────────────────────────────────
interface InProgressCardProps {
  item: Watchlist;
  onProgressUpdate: (item: Watchlist, season: number, episode: number, timestamp: string) => void | Promise<void>;
  onMarkCompleted: (item: Watchlist) => void | Promise<void>;
}

function InProgressCard({ item, onProgressUpdate, onMarkCompleted }: InProgressCardProps) {
  const [showTimestampModal, setShowTimestampModal] = useState(false);
  const media = item.media!;
  const isTv = media.media_type === 'tv';

  return (
    <div className="card flex gap-4 p-4 animate-slide-up relative overflow-hidden group">
      {/* Poster */}
      <div className="relative flex-shrink-0" style={{ width: 68, height: 102, borderRadius: '0.625rem', overflow: 'hidden' }}>
        {media.poster_path ? (
          <Image
            src={posterUrl(media.poster_path, 'w185')}
            alt={media.title}
            fill
            sizes="68px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--color-surface-2))' }}>
            {isTv ? <Tv size={22} style={{ color: 'hsl(var(--color-border))' }} /> : <Film size={22} style={{ color: 'hsl(var(--color-border))' }} />}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold truncate text-[15px]" style={{ color: 'hsl(var(--color-text))' }}>{media.title}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Progress Badge */}
                <span 
                  className="badge flex items-center gap-1 font-bold text-[11px]" 
                  style={{
                    background: isTv ? 'hsl(var(--color-brand) / 0.12)' : 'hsl(var(--color-accent) / 0.12)',
                    color: isTv ? 'hsl(var(--color-brand))' : 'hsl(var(--color-accent))',
                    border: `1px solid ${isTv ? 'hsl(var(--color-brand) / 0.2)' : 'hsl(var(--color-accent) / 0.2)'}`
                  }}
                >
                  {isTv ? `Season ${item.current_season}: Episode ${item.current_episode}` : 'Movie'}
                </span>

                {/* Mid-Episode Timestamp */}
                {item.last_timestamp && (
                  <div
                    className="badge flex items-center gap-1 font-bold text-[11px]"
                    style={{ 
                      background: 'hsl(var(--color-accent) / 0.1)', 
                      color: 'hsl(var(--color-accent))',
                      border: '1px solid hsl(var(--color-accent) / 0.2)'
                    }}
                  >
                    <Clock size={11} />
                    Paused at {item.last_timestamp}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 mt-3">
          <button
            onClick={() => setShowTimestampModal(true)}
            className="btn btn-ghost text-xs flex items-center gap-1"
            style={{ padding: '0.4rem 0.85rem', borderRadius: '0.5rem' }}
          >
            <Clock size={13} />
            Update Progress
          </button>
          <button
            onClick={() => onMarkCompleted(item)}
            className="btn text-xs flex items-center gap-1 hover:scale-[1.02] transition-transform"
            style={{
              padding: '0.4rem 0.85rem',
              background: 'hsl(var(--color-success) / 0.1)',
              color: 'hsl(var(--color-success))',
              border: '1px solid hsl(var(--color-success) / 0.2)',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <CheckCircle2 size={13} />
            {isTv ? 'Mark Episode Watched' : 'Mark Completed'}
          </button>
        </div>
      </div>

      {showTimestampModal && (
        <TimestampModal
          current={item.last_timestamp ?? ''}
          label={media.title}
          isTv={isTv}
          currentSeason={item.current_season}
          currentEpisode={item.current_episode}
          onClose={() => setShowTimestampModal(false)}
          onSave={async (ts, s, e) => {
            await onProgressUpdate(item, s ?? item.current_season, e ?? item.current_episode, ts);
            setShowTimestampModal(false);
          }}
        />
      )}
    </div>
  );
}
