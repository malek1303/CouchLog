'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Film, Trash2, MoreHorizontal, Play, PauseCircle, RotateCcw, CheckCircle2 } from 'lucide-react';
import StarRating from '@/components/ui/star-rating';
import { createClient } from '@/lib/supabase/client';
import { Watchlist, WatchlistStatus } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import { useToast } from '@/hooks/use-toast';

export default function MyListPage() {
  const [items, setItems] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchWatchlist = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('watchlist')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .eq('status', 'to_watch')
      .order('created_at', { ascending: false });
    return (data as Watchlist[]) ?? [];
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const next = await fetchWatchlist();
      if (mounted) {
        setItems(next);
        setLoading(false);
      }
    };
    sync();

    const handleUpdate = () => { sync(); };
    window.addEventListener('couchlog:watchlist-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('couchlog:watchlist-updated', handleUpdate);
    };
  }, [fetchWatchlist]);

  async function updateStatus(watchlistId: string, status: WatchlistStatus) {
    let { error } = await supabase.from('watchlist').update({ status }).eq('id', watchlistId);

    // Fallback if remote DB hasn't added 'rewatch' to the status CHECK constraint yet
    if (error && status === 'rewatch' && error.code === '23514') {
      const retry = await supabase
        .from('watchlist')
        .update({ status: 'completed', last_timestamp: '__rewatch__' })
        .eq('id', watchlistId);
      error = retry.error;
    }

    if (error) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
      return false;
    }
    setItems((prev) => prev.filter((i) => i.id !== watchlistId));
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
    return true;
  }

  async function removeFromList(watchlistId: string) {
    const { error } = await supabase.from('watchlist').delete().eq('id', watchlistId);
    if (error) {
      toast({ title: 'Error removing item', description: error.message, variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== watchlistId));
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
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
            rating={item.media?.vote_average ?? 0}
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
  rating,
  onStatusChange,
  onRemove,
}: {
  item: Watchlist;
  rating: number;
  onStatusChange: (id: string, status: WatchlistStatus) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const media = item.media!;
  const isTv = media.media_type === 'tv';

  useEffect(() => {
    if (!showMenu) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMenu]);

  async function handleStartWatching() {
    const ok = await onStatusChange(item.id, 'watching');
    if (ok) router.push('/in-progress');
  }

  return (
    <div
      className="card flex gap-3 sm:gap-4 p-3.5 sm:p-4 animate-slide-up relative group"
      style={{ zIndex: showMenu ? 20 : undefined }}
    >
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
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight truncate text-[15px]" style={{ color: 'hsl(var(--color-text))' }}>{media.title}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="badge font-bold text-[10px]" style={{
                  background: isTv ? 'hsl(var(--color-brand) / 0.12)' : 'hsl(var(--color-accent) / 0.12)',
                  color: isTv ? 'hsl(var(--color-brand))' : 'hsl(var(--color-accent))',
                  border: `1px solid ${isTv ? 'hsl(var(--color-brand) / 0.2)' : 'hsl(var(--color-accent) / 0.2)'}`
                }}>
                  {isTv ? 'TV' : 'Movie'}
                </span>
                <StarRating rating={rating} size="sm" />
              </div>
            </div>

            {/* Remove / Options Menu */}
            <div className="relative flex-shrink-0" ref={menuRef}>
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
                  className="absolute right-0 top-full mt-1.5 z-30 rounded-xl overflow-hidden animate-scale-in"
                  style={{
                    background: 'hsl(var(--color-surface-2))',
                    border: '1px solid hsl(var(--color-border))',
                    minWidth: 190,
                    boxShadow: 'var(--shadow-card), 0 10px 30px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <button
                    onClick={() => { onStatusChange(item.id, 'watching'); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left hover:bg-white/[0.04] transition-all"
                    style={{ color: 'hsl(var(--color-text))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Play size={14} className="text-brand" />
                    Actively Watching
                  </button>
                  <button
                    onClick={() => { onStatusChange(item.id, 'dropped'); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left hover:bg-white/[0.04] transition-all"
                    style={{ color: 'hsl(var(--color-text))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <PauseCircle size={14} style={{ color: 'hsl(var(--color-warning))' }} />
                    Come Back Later
                  </button>
                  <button
                    onClick={() => { onStatusChange(item.id, 'rewatch'); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left hover:bg-white/[0.04] transition-all"
                    style={{ color: 'hsl(var(--color-text))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <RotateCcw size={14} className="text-accent" />
                    Want to Rewatch
                  </button>
                  <button
                    onClick={() => { onStatusChange(item.id, 'completed'); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left hover:bg-white/[0.04] transition-all"
                    style={{ color: 'hsl(var(--color-text))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckCircle2 size={14} style={{ color: 'hsl(var(--color-success))' }} />
                    Mark Finished
                  </button>
                  <div style={{ height: 1, background: 'hsl(var(--color-border))', margin: '0.25rem 0' }} />
                  <button
                    onClick={() => { onRemove(item.id); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left hover:bg-white/[0.04] transition-all"
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
              padding: '0.45rem 1.1rem',
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
