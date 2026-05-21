'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Film, Trash2, MoreHorizontal, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Watchlist, WatchlistStatus } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import { useToast } from '@/hooks/use-toast';

export default function MyListPage() {
  const [items, setItems] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const loadWatchlist = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('watchlist')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .eq('status', 'to_watch')
      .order('created_at', { ascending: false });
    setItems((data as Watchlist[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  async function updateStatus(watchlistId: string, status: WatchlistStatus) {
    await supabase.from('watchlist').update({ status }).eq('id', watchlistId);
    setItems((prev) => prev.filter((i) => i.id !== watchlistId));
  }

  async function removeFromList(watchlistId: string) {
    await supabase.from('watchlist').delete().eq('id', watchlistId);
    setItems((prev) => prev.filter((i) => i.id !== watchlistId));
    toast({ title: 'Removed from watchlist' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--color-brand))' }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="mb-1">Watchlist</h1>
        <p className="text-muted mb-12">Manage your watchlist and track progress.</p>
        <div className="text-center py-20">
          <Film size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">Your watchlist is empty</p>
          <p className="text-subtle text-sm mt-1">Search for movies and TV shows to add them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="mb-1">Watchlist</h1>
        <p className="text-muted">{items.length} title{items.length !== 1 ? 's' : ''} saved</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <WatchlistItem
            key={item.id}
            item={item}
            onStatusChange={updateStatus}
            onRemove={removeFromList}
          />
        ))}
      </div>
    </div>
  );
}

// ── WatchlistItem ──────────────────────────────────────────────
function WatchlistItem({
  item,
  onStatusChange,
  onRemove,
}: {
  item: Watchlist;
  onStatusChange: (id: string, status: WatchlistStatus) => void;
  onRemove: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const media = item.media!;
  const isTv = media.media_type === 'tv';

  async function handleStartWatching() {
    await onStatusChange(item.id, 'watching');
    router.push('/in-progress');
  }

  return (
    <div className="card flex gap-4 p-4 animate-slide-up relative overflow-hidden group">
      {/* Poster thumbnail */}
      <div className="relative flex-shrink-0" style={{ width: 56, height: 84, borderRadius: '0.5rem', overflow: 'hidden' }}>
        {media.poster_path ? (
          <Image
            src={posterUrl(media.poster_path, 'w185')}
            alt={media.title}
            fill
            sizes="56px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--color-surface-2))' }}>
            {isTv ? (
              <span className="text-[10px] font-bold text-subtle">TV</span>
            ) : (
              <span className="text-[10px] font-bold text-subtle">Movie</span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight truncate text-[15px]" style={{ color: 'hsl(var(--color-text))' }}>{media.title}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="badge font-bold text-[10px]" style={{
                  background: isTv ? 'hsl(var(--color-brand) / 0.12)' : 'hsl(var(--color-accent) / 0.12)',
                  color: isTv ? 'hsl(var(--color-brand))' : 'hsl(var(--color-accent))',
                  border: `1px solid ${isTv ? 'hsl(var(--color-brand) / 0.2)' : 'hsl(var(--color-accent) / 0.2)'}`
                }}>
                  {isTv ? 'TV' : 'Movie'}
                </span>
              </div>
            </div>

            {/* Remove / Options Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="btn btn-ghost p-1.5"
                aria-label="More options"
                style={{ borderRadius: '0.5rem', minWidth: 0 }}
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden"
                  style={{ background: 'hsl(var(--color-surface-2))', border: '1px solid hsl(var(--color-border))', minWidth: 140 }}
                >
                  <button
                    onClick={() => { onRemove(item.id); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-all"
                    style={{ color: 'hsl(var(--color-error))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Start Watching Button */}
        <div className="flex items-center mt-3">
          <button
            onClick={handleStartWatching}
            className="btn text-xs flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
            style={{
              padding: '0.45rem 1.25rem',
              background: 'linear-gradient(90deg, hsl(var(--color-brand)) 0%, hsl(var(--color-accent)) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Play size={12} fill="#fff" />
            Start Watching
          </button>
        </div>
      </div>
    </div>
  );
}
