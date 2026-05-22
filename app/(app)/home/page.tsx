'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Search as SearchIcon, X, Plus, Check, Loader2, Film, Tv } from 'lucide-react';
import { TmdbSearchResult } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { posterUrl } from '@/lib/tmdb';
import { useToast } from '@/hooks/use-toast';

const RecommendationSkeleton = () => (
  <div
    className="grid gap-4"
    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="card" style={{ borderRadius: '0.875rem', overflow: 'hidden', padding: 0 }}>
        <div className="skeleton" style={{ paddingBottom: '150%', width: '100%', borderRadius: 0 }} />
        <div style={{ padding: '0.75rem' }}>
          <div className="skeleton" style={{ height: '1.25rem', width: '70%', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '0.75rem', width: '40%', marginBottom: '1rem' }} />
          <div className="skeleton" style={{ height: '2rem', width: '100%', borderRadius: '0.375rem' }} />
        </div>
      </div>
    ))}
  </div>
);

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [trendingMovies, setTrendingMovies] = useState<TmdbSearchResult[]>([]);
  const [trendingTv, setTrendingTv] = useState<TmdbSearchResult[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  // Load user's existing watchlist media tmdb_ids
  useEffect(() => {
    async function loadWatchlist() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('watchlist')
        .select('media!inner(tmdb_id, media_type)')
        .eq('user_id', user.id);
      if (data) {
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
  }, [supabase]);

  // Load trending recommendations
  useEffect(() => {
    async function loadRecommendations() {
      setLoadingRecommendations(true);
      try {
        const [moviesRes, tvRes] = await Promise.all([
          fetch('/api/tmdb/trending?type=movie'),
          fetch('/api/tmdb/trending?type=tv'),
        ]);
        if (moviesRes.ok && tvRes.ok) {
          const moviesData = await moviesRes.json();
          const tvData = await tvRes.json();
          
          // Ensure media_type is set correctly
          const movies = (moviesData.results ?? []).map((m: any) => ({ ...m, media_type: 'movie' }));
          const tvShows = (tvData.results ?? []).map((t: any) => ({ ...t, media_type: 'tv' }));

          setTrendingMovies(movies.slice(0, 10)); // Top 10 movies
          setTrendingTv(tvShows.slice(0, 10)); // Top 10 TV shows
        }
      } catch (err) {
        console.error('Failed to fetch trending recommendations:', err);
      } finally {
        setLoadingRecommendations(false);
      }
    }
    loadRecommendations();
  }, []);

  const doSearch = useCallback(async (q: string, type: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (type !== 'all') params.set('type', type);
      const res = await fetch(`/api/tmdb/search?${params}`);
      const data = await res.json();
      const filtered = (data.results ?? []).filter(
        (r: TmdbSearchResult) => r.media_type === 'movie' || r.media_type === 'tv'
      );
      setResults(filtered);
    } catch {
      toast({ title: 'Search failed', description: 'Could not reach TMDB.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, mediaType), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mediaType, doSearch]);

  async function addToWatchlist(item: TmdbSearchResult, status: 'to_watch' | 'watching') {
    const key = `${item.id}-${item.media_type}`;
    if (watchlistIds.has(key) || addingId === key) return;
    setAddingId(key);

    try {
      // 1. Upsert into media table (server action)
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
        status: status,
        current_season: 1,
        current_episode: 1,
      });
      if (error && error.code !== '23505') throw error;

      setWatchlistIds((prev) => new Set([...prev, key]));
      
      const successTitle = status === 'to_watch' ? 'Added to Watchlist!' : 'Started Watching!';
      const successDesc = status === 'to_watch' 
        ? `${item.title ?? item.name} is now in your Watchlist.`
        : `${item.title ?? item.name} is now in In Progress.`;
      
      toast({ title: successTitle, description: successDesc });
    } catch (err: any) {
      const message = err?.message || (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      toast({ title: 'Failed to add', description: message, variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  }

  const renderMediaCard = (item: TmdbSearchResult) => {
    const key = `${item.id}-${item.media_type}`;
    const inList = watchlistIds.has(key);
    const isAdding = addingId === key;
    const title = item.title ?? item.name ?? 'Unknown';
    const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);

    return (
      <div key={key} className="card animate-slide-up" style={{ borderRadius: '0.875rem', overflow: 'hidden', padding: 0 }}>
        {/* Poster */}
        <div className="relative" style={{ paddingBottom: '150%' }}>
          {item.poster_path ? (
            <Image
              src={posterUrl(item.poster_path, 'w342')}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, 200px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'hsl(var(--color-surface-2))' }}
            >
              {item.media_type === 'tv' ? <Tv size={40} style={{ color: 'hsl(var(--color-border))' }} /> : <Film size={40} style={{ color: 'hsl(var(--color-border))' }} />}
            </div>
          )}
          {/* Type badge */}
          <span
            className="absolute top-2 left-2 badge"
            style={{
              background: item.media_type === 'tv' ? 'hsl(var(--color-brand) / 0.85)' : 'hsl(var(--color-accent) / 0.85)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
          >
            {item.media_type === 'tv' ? 'TV' : 'Film'}
          </span>
        </div>

        {/* Info */}
        <div style={{ padding: '0.75rem' }}>
          <p className="text-sm font-semibold leading-tight truncate" title={title}>{title}</p>
          {year && <p className="text-subtle text-xs mt-0.5">{year}</p>}
          {inList ? (
            <button
              disabled
              className="btn w-full mt-2.5 text-xs flex items-center justify-center gap-1"
              style={{
                padding: '0.45rem 0',
                background: 'hsl(var(--color-success) / 0.12)',
                color: 'hsl(var(--color-success))',
                border: '1px solid hsl(var(--color-success) / 0.25)',
                cursor: 'default',
              }}
            >
              <Check size={12} /> In List
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 mt-2.5">
              <button
                id={`add-watchlist-${item.media_type}-${item.id}`}
                onClick={() => addToWatchlist(item, 'to_watch')}
                disabled={isAdding}
                className="btn w-full text-xs flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                style={{
                  padding: '0.45rem 0',
                  background: 'hsl(var(--color-brand) / 0.1)',
                  color: 'hsl(var(--color-brand))',
                  border: '1px solid hsl(var(--color-brand) / 0.25)',
                  cursor: 'pointer',
                }}
              >
                {isAdding ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <><Plus size={12} /> Watchlist</>
                )}
              </button>
              <button
                id={`start-watching-${item.media_type}-${item.id}`}
                onClick={() => addToWatchlist(item, 'watching')}
                disabled={isAdding}
                className="btn w-full text-xs flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                style={{
                  padding: '0.45rem 0',
                  background: 'hsl(var(--color-accent) / 0.1)',
                  color: 'hsl(var(--color-accent))',
                  border: '1px solid hsl(var(--color-accent) / 0.25)',
                  cursor: 'pointer',
                }}
              >
                {isAdding ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <><Plus size={12} /> Start Watching</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="mb-1">Home</h1>
        <p className="text-muted">Discover trending and popular movies and TV shows.</p>
      </div>

      {/* Search bar + type filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <SearchIcon
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'hsl(var(--color-text-subtle))' }}
          />
          <input
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows..."
            style={{ paddingLeft: '3rem', paddingRight: query ? '3rem' : '1rem', height: '3rem' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text-subtle))' }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Type toggle */}
        <div
          className="flex rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: '1px solid hsl(var(--color-border))', background: 'hsl(var(--color-surface))' }}
          role="group"
          aria-label="Media type filter"
        >
          {(['all', 'tv', 'movie'] as const).map((t) => (
            <button
              key={t}
              id={`filter-${t}`}
              onClick={() => setMediaType(t)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: mediaType === t ? 'hsl(var(--color-brand) / 0.2)' : 'transparent',
                color: mediaType === t ? 'hsl(var(--color-brand))' : 'hsl(var(--color-text-muted))',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t === 'tv' ? <Tv size={14} /> : t === 'movie' ? <Film size={14} /> : null}
              {t === 'all' ? 'All' : t === 'tv' ? 'TV' : 'Movies'}
            </button>
          ))}
        </div>
      </div>

      {/* Results / Recommendations Loading States */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--color-brand))' }} />
        </div>
      )}

      {/* Search results rendering */}
      {!loading && query.length >= 2 && (
        <>
          {results.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <p className="text-muted text-lg">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-subtle text-sm mt-1">Try a different search term or filter.</p>
            </div>
          ) : (
            <div
              className="grid gap-4 animate-fade-in"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
            >
              {results.map(renderMediaCard)}
            </div>
          )}
        </>
      )}

      {/* Recommendations Feed when no search query */}
      {!loading && query.length < 2 && (
        <div className="space-y-10 animate-fade-in">
          {loadingRecommendations && (
            <div className="space-y-10">
              {(mediaType === 'all' || mediaType === 'movie') && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--color-text))' }}>
                    <Film size={18} style={{ color: 'hsl(var(--color-accent))' }} /> Trending Movies
                  </h2>
                  <RecommendationSkeleton />
                </div>
              )}
              {(mediaType === 'all' || mediaType === 'tv') && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--color-text))' }}>
                    <Tv size={18} style={{ color: 'hsl(var(--color-brand))' }} /> Trending TV Shows
                  </h2>
                  <RecommendationSkeleton />
                </div>
              )}
            </div>
          )}

          {!loadingRecommendations && (
            <>
              {(mediaType === 'all' || mediaType === 'movie') && trendingMovies.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--color-text))' }}>
                    <Film size={18} style={{ color: 'hsl(var(--color-accent))' }} /> Trending Movies
                  </h2>
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
                  >
                    {trendingMovies.map(renderMediaCard)}
                  </div>
                </div>
              )}

              {(mediaType === 'all' || mediaType === 'tv') && trendingTv.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--color-text))' }}>
                    <Tv size={18} style={{ color: 'hsl(var(--color-brand))' }} /> Trending TV Shows
                  </h2>
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
                  >
                    {trendingTv.map(renderMediaCard)}
                  </div>
                </div>
              )}

              {/* Backwards Search Helper Tip */}
              <div className="text-center py-8 border-t border-dashed" style={{ borderColor: 'hsl(var(--color-border))', marginTop: '3rem' }}>
                <p className="text-subtle text-sm">
                  Can&apos;t find what you&apos;re looking for? Use the search bar above to query millions of movies and TV shows.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
