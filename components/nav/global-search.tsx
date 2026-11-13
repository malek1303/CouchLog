'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Search as SearchIcon, X, Plus, Check, Loader2, Film, Tv } from 'lucide-react';
import StarRating from '@/components/ui/star-rating';
import { TmdbSearchResult } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { posterUrl } from '@/lib/tmdb';
import { useToast } from '@/hooks/use-toast';

interface GlobalSearchProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function GlobalSearch({ isOpen, onOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  // Focus input & manage body scroll on open/close
  useEffect(() => {
    if (isOpen) {
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(focusTimer);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  // Global keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
        return;
      }

      if (isInput && !isOpen) return;

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          onOpen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpen, handleClose]);

  // Load user's watchlist and stay synced with watchlist updates
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadWatchlist() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data } = await supabase
        .from('watchlist')
        .select('media!inner(tmdb_id, media_type)')
        .eq('user_id', user.id);
      if (data && mounted) {
        const ids = new Set(
          data.map((w) => {
            const m = w.media as unknown as { tmdb_id: number; media_type: string };
            return `${m.tmdb_id}-${m.media_type}`;
          })
        );
        setWatchlistIds(ids);
      }
    }

    loadWatchlist();
    const handleWatchlistUpdate = () => { loadWatchlist(); };
    window.addEventListener('couchlog:watchlist-updated', handleWatchlistUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('couchlog:watchlist-updated', handleWatchlistUpdate);
    };
  }, [supabase, isOpen]);

  // Search logic
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const filtered = (data.results ?? []).filter(
        (r: TmdbSearchResult) => r.media_type === 'movie' || r.media_type === 'tv'
      );
      setResults(filtered.slice(0, 8)); // Top 8 results to fit cleanly
    } catch {
      toast({ title: 'Search failed', description: 'Could not reach TMDB.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Add to Watchlist
  async function addToWatchlist(item: TmdbSearchResult, status: 'to_watch' | 'watching') {
    const key = `${item.id}-${item.media_type}`;
    if (watchlistIds.has(key) || addingId === key) return;
    setAddingId(key);

    try {
      // 1. Upsert into media table
      const res = await fetch('/api/media/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: item.id,
          media_type: item.media_type,
          title: item.title ?? item.name ?? 'Unknown',
          poster_path: item.poster_path,
          overview: item.overview,
          status: item.status ?? null,
          vote_average: item.vote_average ?? 0,
        }),
      });

      if (!res.ok) throw new Error('Media upsert failed');
      const { media_id } = await res.json();

      // 2. Insert into watchlist
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id,
        media_id,
        status,
        current_season: 1,
        current_episode: 1,
      });
      if (error && error.code !== '23505') throw error;

      setWatchlistIds((prev) => new Set([...prev, key]));
      window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));

      const successTitle = status === 'to_watch' ? 'Added to Watchlist!' : 'Started Watching!';
      const successDesc = status === 'to_watch'
        ? `${item.title ?? item.name} is now in your Watchlist.`
        : `${item.title ?? item.name} is now in In Progress.`;

      toast({ title: successTitle, description: successDesc });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to add', description: message, variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-10 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        className="glass w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl mt-6 sm:mt-12 animate-slide-up"
        style={{
          background: 'hsl(var(--color-surface) / 0.95)',
          border: '1px solid hsl(var(--color-border))',
          boxShadow: 'var(--shadow-card), var(--shadow-glow)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Area */}
        <div className="flex items-center gap-3 p-3.5 sm:p-4 border-b" style={{ borderColor: 'hsl(var(--color-border))' }}>
          <SearchIcon size={20} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies or TV shows..."
            className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:shadow-none text-base min-w-0"
            style={{ height: 'auto', border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="p-1 hover:bg-surface-2 rounded-lg text-muted hover:text-normal transition-colors flex-shrink-0"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="text-xs px-2 py-1 rounded bg-surface-2 text-muted border font-semibold flex items-center gap-1 flex-shrink-0"
            style={{
              borderColor: 'hsl(var(--color-border))',
              background: 'hsl(var(--color-surface-2))',
              border: '1px solid hsl(var(--color-border))',
              cursor: 'pointer'
            }}
          >
            <span className="hidden sm:inline">ESC</span>
            <X size={14} className="sm:hidden" />
          </button>
        </div>

        {/* Results Container */}
        <div
          className="max-h-[65vh] overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3"
          style={{ minHeight: '120px' }}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="animate-spin text-brand" size={28} />
              <p className="text-xs text-muted">Searching TMDB...</p>
            </div>
          )}

          {!loading && !query && (
            <div className="text-center py-8 text-muted">
              <p className="text-sm">Type to search across movies and TV shows...</p>
              <p className="hidden sm:flex text-xs text-subtle mt-1.5 items-center justify-center gap-1.5">
                <span>Tip: Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border text-[10px] font-bold" style={{ background: 'hsl(var(--color-surface-2))', borderColor: 'hsl(var(--color-border))' }}>/</kbd>
                <span>or</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border text-[10px] font-bold" style={{ background: 'hsl(var(--color-surface-2))', borderColor: 'hsl(var(--color-border))' }}>⌘K</kbd>
                <span>anywhere to toggle search.</span>
              </p>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-10 text-muted">
              <p className="text-sm font-semibold">No matches found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-subtle mt-1">Check spelling or try another term.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((item) => {
                const key = `${item.id}-${item.media_type}`;
                const inList = watchlistIds.has(key);
                const isAdding = addingId === key;
                const title = item.title ?? item.name ?? 'Unknown';
                const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-2.5 rounded-xl transition-all duration-200"
                    style={{
                      background: 'hsl(var(--color-surface-2) / 0.4)',
                      border: '1px solid hsl(var(--color-border) / 0.5)'
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Poster thumbnail */}
                      <div
                        className="relative w-11 h-16 rounded-md overflow-hidden bg-surface-3 flex-shrink-0"
                        style={{ background: 'hsl(var(--color-surface-3))' }}
                      >
                        {item.poster_path ? (
                          <Image
                            src={posterUrl(item.poster_path, 'w185')}
                            alt={title}
                            fill
                            sizes="44px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {item.media_type === 'tv' ? <Tv size={16} className="text-subtle" /> : <Film size={16} className="text-subtle" />}
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: item.media_type === 'tv' ? 'hsl(var(--color-brand) / 0.15)' : 'hsl(var(--color-accent) / 0.15)',
                              color: item.media_type === 'tv' ? 'hsl(var(--color-brand))' : 'hsl(var(--color-accent))',
                            }}
                          >
                            {item.media_type === 'tv' ? 'TV' : 'FILM'}
                          </span>
                          {year && <span className="text-[11px] text-muted">{year}</span>}
                          <StarRating rating={item.vote_average} size="sm" />
                        </div>
                        <h4 className="text-sm font-semibold truncate mt-0.5" style={{ color: 'hsl(var(--color-text))' }}>{title}</h4>
                        <p className="text-xs text-subtle truncate mt-0.5 leading-tight">{item.overview || 'No description available.'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'hsl(var(--color-border) / 0.35)' }}>
                      {inList ? (
                        <span
                          className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold"
                          style={{
                            background: 'hsl(var(--color-success) / 0.1)',
                            color: 'hsl(var(--color-success))',
                            border: '1px solid hsl(var(--color-success) / 0.2)'
                          }}
                        >
                          <Check size={12} /> In List
                        </span>
                      ) : (
                        <>
                          <button
                            id={`global-add-watchlist-${item.media_type}-${item.id}`}
                            onClick={() => addToWatchlist(item, 'to_watch')}
                            disabled={isAdding}
                            className="btn py-1.5 px-3 text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1 font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                            style={{
                              background: 'hsl(var(--color-brand) / 0.1)',
                              color: 'hsl(var(--color-brand))',
                              border: '1px solid hsl(var(--color-brand) / 0.25)',
                              cursor: 'pointer'
                            }}
                          >
                            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} /> Watchlist</>}
                          </button>
                          <button
                            id={`global-start-watching-${item.media_type}-${item.id}`}
                            onClick={() => addToWatchlist(item, 'watching')}
                            disabled={isAdding}
                            className="btn py-1.5 px-3 text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1 font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                            style={{
                              background: 'hsl(var(--color-accent) / 0.1)',
                              color: 'hsl(var(--color-accent))',
                              border: '1px solid hsl(var(--color-accent) / 0.25)',
                              cursor: 'pointer'
                            }}
                          >
                            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} /> Watch</>}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
