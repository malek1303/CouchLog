'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Clock, Loader2, CheckCircle2, Tv, Film, ChevronDown, ChevronUp, Check,
  Bell, CalendarClock, Lock, GripVertical, MoreHorizontal, PauseCircle,
  RotateCcw, Play, List, Trash2
} from 'lucide-react';
import StarRating from '@/components/ui/star-rating';
import { createClient } from '@/lib/supabase/client';
import {
  Watchlist, WatchlistStatus, InProgressCategory, EpisodeProgress,
  TmdbTvDetails, TmdbSeason, TmdbEpisode
} from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import TimestampModal, { SeasonOption } from '@/components/progress/timestamp-modal';
import { useToast } from '@/hooks/use-toast';

// ── Air-Date Helpers ───────────────────────────────────────────

function getTodayIso(): string {
  // Local calendar date in YYYY-MM-DD format
  return new Date().toLocaleDateString('en-CA');
}

function isEpisodeAired(airDate: string | null | undefined): boolean {
  if (!airDate) return false;
  return airDate <= getTodayIso();
}

function formatAirDate(airDate: string | null | undefined): string {
  if (!airDate) return 'TBA';
  const parts = airDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return airDate;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Category Configuration (Issue #7) ──────────────────────────

const REWATCH_MARKER = '__rewatch__';

interface CategoryConfig {
  id: InProgressCategory;
  label: string;
  description: string;
  dbStatus: WatchlistStatus;
  accentColor: string;
  icon: typeof Play;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'watching',
    label: 'Actively Watching',
    description: 'Shows and movies you are currently watching.',
    dbStatus: 'watching',
    accentColor: 'hsl(var(--color-brand))',
    icon: Play,
  },
  {
    id: 'come_back_later',
    label: 'Come Back Later',
    description: 'Titles paused or set aside for later.',
    dbStatus: 'dropped',
    accentColor: 'hsl(var(--color-warning))',
    icon: PauseCircle,
  },
  {
    id: 'rewatch',
    label: 'Want to Rewatch',
    description: 'Favorites queued up for another watch.',
    dbStatus: 'rewatch',
    accentColor: 'hsl(var(--color-accent))',
    icon: RotateCcw,
  },
  {
    id: 'completed',
    label: 'Finished',
    description: 'Shows and movies you have completed.',
    dbStatus: 'completed',
    accentColor: 'hsl(var(--color-success))',
    icon: CheckCircle2,
  },
];

function getItemCategory(item: Watchlist): InProgressCategory {
  if (item.status === 'rewatch') return 'rewatch';
  if (item.status === 'completed') {
    return item.last_timestamp === REWATCH_MARKER ? 'rewatch' : 'completed';
  }
  if (item.status === 'dropped') return 'come_back_later';
  return 'watching';
}

function getEffectiveTimestamp(item: Watchlist): string | null {
  if (!item.last_timestamp || item.last_timestamp === REWATCH_MARKER) return null;
  return item.last_timestamp;
}

// ── Page Component ─────────────────────────────────────────────

export default function InProgressPage() {
  const [items, setItems] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | InProgressCategory>('all');
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<InProgressCategory | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  // Enable smooth edge auto-scrolling and mouse-wheel scrolling while dragging a card
  useEffect(() => {
    if (!draggingItemId) return;

    let pointerY: number | null = null;
    let rafId: number | null = null;
    const EDGE_THRESHOLD = 140;
    const MAX_SCROLL_SPEED = 20;

    const updatePointer = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientY > 0 || e.clientX > 0) {
        pointerY = e.clientY;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      window.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: 'instant' as ScrollBehavior,
      });
    };

    const tick = () => {
      if (pointerY !== null) {
        const vh = window.innerHeight;
        let delta = 0;
        if (pointerY > vh - EDGE_THRESHOLD) {
          const ratio = Math.min(1, (pointerY - (vh - EDGE_THRESHOLD)) / EDGE_THRESHOLD);
          delta = Math.ceil(ratio * MAX_SCROLL_SPEED);
        } else if (pointerY < EDGE_THRESHOLD) {
          const ratio = Math.min(1, (EDGE_THRESHOLD - pointerY) / EDGE_THRESHOLD);
          delta = -Math.ceil(ratio * MAX_SCROLL_SPEED);
        }
        if (delta !== 0) {
          window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('dragover', updatePointer);
    window.addEventListener('drag', updatePointer);
    window.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('dragover', updatePointer);
      window.removeEventListener('drag', updatePointer);
      window.removeEventListener('wheel', handleWheel, { capture: true });
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [draggingItemId]);

  const fetchInProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('watchlist')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .neq('status', 'to_watch')
      .order('created_at', { ascending: false });

    return (data as Watchlist[]) ?? [];
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const next = await fetchInProgress();
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
  }, [fetchInProgress]);

  const updateProgress = useCallback(async (
    item: Watchlist,
    season: number,
    episode: number,
    timestamp: string,
    silent = false
  ) => {
    const nextTimestamp =
      item.status === 'completed' && item.last_timestamp === REWATCH_MARKER && !timestamp
        ? REWATCH_MARKER
        : (timestamp || null);

    const { error } = await supabase
      .from('watchlist')
      .update({
        current_season: season,
        current_episode: episode,
        last_timestamp: nextTimestamp,
      })
      .eq('id', item.id);

    if (error) {
      if (!silent) {
        toast({ title: 'Error saving progress', description: error.message, variant: 'destructive' });
      }
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, current_season: season, current_episode: episode, last_timestamp: nextTimestamp }
          : i
      )
    );
    if (!silent) {
      toast({ title: 'Progress updated!' });
    }
  }, [supabase, toast]);

  const moveItemToCategory = useCallback(async (itemId: string, category: InProgressCategory) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;
    if (getItemCategory(targetItem) === category) return;

    const config = CATEGORIES.find((c) => c.id === category)!;
    const cleanTimestamp = getEffectiveTimestamp(targetItem);

    let appliedStatus: WatchlistStatus = config.dbStatus;
    let appliedTimestamp: string | null = cleanTimestamp;

    let { error } = await supabase
      .from('watchlist')
      .update({
        status: appliedStatus,
        last_timestamp: appliedTimestamp,
      })
      .eq('id', itemId);

    // Fallback if remote Supabase DB hasn't added 'rewatch' to the status CHECK constraint yet
    if (error && category === 'rewatch' && error.code === '23514') {
      appliedStatus = 'completed';
      appliedTimestamp = REWATCH_MARKER;
      const retry = await supabase
        .from('watchlist')
        .update({
          status: appliedStatus,
          last_timestamp: appliedTimestamp,
        })
        .eq('id', itemId);
      error = retry.error;
    }

    if (error) {
      toast({ title: 'Could not move item', description: error.message, variant: 'destructive' });
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: appliedStatus, last_timestamp: appliedTimestamp }
          : i
      )
    );
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
    toast({ title: `Moved to ${config.label}`, description: targetItem.media?.title });
  }, [items, supabase, toast]);

  const moveItemToWatchlist = useCallback(async (itemId: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    const { error } = await supabase
      .from('watchlist')
      .update({ status: 'to_watch', last_timestamp: getEffectiveTimestamp(targetItem ?? ({} as Watchlist)) })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Could not move to Watchlist', description: error.message, variant: 'destructive' });
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
    toast({ title: 'Moved to Watchlist', description: targetItem?.media?.title });
  }, [items, supabase, toast]);

  const removeItem = useCallback(async (itemId: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    const { error } = await supabase.from('watchlist').delete().eq('id', itemId);
    if (error) {
      toast({ title: 'Error removing item', description: error.message, variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
    toast({ title: 'Removed from list', description: targetItem?.media?.title });
  }, [items, supabase, toast]);

  async function markMovieCompleted(item: Watchlist) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && item.media_id) {
      await supabase.from('movie_progress').upsert({
        user_id: user.id,
        media_id: item.media_id,
        watched: true,
        watched_at: new Date().toISOString(),
        stopped_at_timestamp: null,
      }, { onConflict: 'user_id,media_id' });
    }

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

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, status: 'completed', last_timestamp: null }
          : i
      )
    );
    window.dispatchEvent(new CustomEvent('couchlog:watchlist-updated'));
    toast({ title: 'Movie marked as finished!', description: `${item.media?.title ?? 'Movie'} moved to Finished.` });
  }

  function handleDropOnCategory(e: React.DragEvent, category: InProgressCategory) {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingItemId;
    setDragOverCategory(null);
    setDraggingItemId(null);
    if (droppedId) {
      moveItemToCategory(droppedId, category);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--color-brand))' }} />
      </div>
    );
  }

  const groupedItems: Record<InProgressCategory, Watchlist[]> = {
    watching: [],
    come_back_later: [],
    rewatch: [],
    completed: [],
  };

  for (const item of items) {
    groupedItems[getItemCategory(item)].push(item);
  }

  const visibleCategories = activeFilter === 'all'
    ? CATEGORIES
    : CATEGORIES.filter((c) => c.id === activeFilter);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="mb-1">In Progress</h1>
        <p className="text-muted text-sm sm:text-base">
          {items.length === 0
            ? 'Nothing tracked here yet.'
            : `${items.length} title${items.length !== 1 ? 's' : ''} across your tracking categories. Drag cards between categories or use the card menu.`}
        </p>
      </div>

      {/* Category Filter Pills (also act as Drag & Drop targets) */}
      <div
        className="sticky top-16 lg:top-3 z-20 flex flex-wrap gap-2 mb-6 py-2 px-2 -mx-2 rounded-2xl backdrop-blur-md"
        style={{ background: 'hsl(var(--color-bg) / 0.8)' }}
      >
        <button
          onClick={() => setActiveFilter('all')}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            background: activeFilter === 'all' ? 'hsl(var(--color-brand))' : 'hsl(var(--color-surface))',
            color: activeFilter === 'all' ? '#fff' : 'hsl(var(--color-text-muted))',
            border: `1px solid ${activeFilter === 'all' ? 'hsl(var(--color-brand))' : 'hsl(var(--color-border))'}`,
            cursor: 'pointer',
          }}
        >
          All ({items.length})
        </button>

        {CATEGORIES.map((cat) => {
          const count = groupedItems[cat.id].length;
          const isSelected = activeFilter === cat.id;
          const isDropTarget = dragOverCategory === cat.id;
          const Icon = cat.icon;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCategory !== cat.id) setDragOverCategory(cat.id);
              }}
              onDragLeave={() => {
                if (dragOverCategory === cat.id) setDragOverCategory(null);
              }}
              onDrop={(e) => handleDropOnCategory(e, cat.id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isDropTarget
                  ? 'hsl(var(--color-brand) / 0.25)'
                  : isSelected
                    ? 'hsl(var(--color-brand) / 0.18)'
                    : 'hsl(var(--color-surface))',
                color: isSelected || isDropTarget ? cat.accentColor : 'hsl(var(--color-text-muted))',
                border: `1px solid ${isDropTarget ? cat.accentColor : isSelected ? cat.accentColor : 'hsl(var(--color-border))'}`,
                boxShadow: isDropTarget ? `0 0 0 2px hsl(var(--color-brand) / 0.25)` : undefined,
                cursor: 'pointer',
              }}
            >
              <Icon size={12} />
              <span>{cat.label}</span>
              <span className="opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">Nothing in progress</p>
          <p className="text-subtle text-sm mt-1">Start watching a show or movie from Home or Watchlist to track progress here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleCategories.map((cat) => {
            const catItems = groupedItems[cat.id];
            const isDropTarget = dragOverCategory === cat.id;
            const Icon = cat.icon;

            return (
              <section
                key={cat.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCategory !== cat.id) setDragOverCategory(cat.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCategory(null);
                  }
                }}
                onDrop={(e) => handleDropOnCategory(e, cat.id)}
                className="rounded-2xl p-3 sm:p-4 transition-all"
                style={{
                  background: isDropTarget ? 'hsl(var(--color-brand) / 0.06)' : 'hsl(var(--color-surface) / 0.35)',
                  border: isDropTarget
                    ? `2px dashed ${cat.accentColor}`
                    : '1px solid hsl(var(--color-border) / 0.6)',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-3 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(var(--color-surface-2))', color: cat.accentColor }}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <span>{cat.label}</span>
                        <span className="text-xs font-semibold text-subtle">({catItems.length})</span>
                      </h2>
                      <p className="text-[11px] text-subtle hidden sm:block">{cat.description}</p>
                    </div>
                  </div>
                  {draggingItemId && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cat.accentColor, background: 'hsl(var(--color-surface-2))' }}>
                      Drop here
                    </span>
                  )}
                </div>

                {catItems.length === 0 ? (
                  <div
                    className="rounded-xl py-6 px-4 text-center text-xs text-subtle"
                    style={{
                      border: '1px dashed hsl(var(--color-border))',
                      background: 'hsl(var(--color-surface) / 0.4)',
                    }}
                  >
                    {draggingItemId
                      ? `Drop card here to move to ${cat.label}`
                      : `No titles in ${cat.label}. Drag a card here or use a card's menu to move titles.`}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {catItems.map((item) => (
                      <InProgressCard
                        key={item.id}
                        item={item}
                        category={cat.id}
                        isDragging={draggingItemId === item.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingItemId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggingItemId(null);
                          setDragOverCategory(null);
                        }}
                        onProgressUpdate={updateProgress}
                        onMarkMovieCompleted={markMovieCompleted}
                        onMoveCategory={(targetCat) => moveItemToCategory(item.id, targetCat)}
                        onMoveToWatchlist={() => moveItemToWatchlist(item.id)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── InProgressCard ─────────────────────────────────────────────
interface InProgressCardProps {
  item: Watchlist;
  category: InProgressCategory;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onProgressUpdate: (
    item: Watchlist,
    season: number,
    episode: number,
    timestamp: string,
    silent?: boolean
  ) => void | Promise<void>;
  onMarkMovieCompleted: (item: Watchlist) => void | Promise<void>;
  onMoveCategory: (category: InProgressCategory) => void | Promise<void>;
  onMoveToWatchlist: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}

function InProgressCard({
  item,
  category,
  isDragging,
  onDragStart,
  onDragEnd,
  onProgressUpdate,
  onMarkMovieCompleted,
  onMoveCategory,
  onMoveToWatchlist,
  onRemove,
}: InProgressCardProps) {
  const [showTimestampModal, setShowTimestampModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const media = item.media!;
  const isTv = media.media_type === 'tv';

  const [showData, setShowData] = useState<TmdbTvDetails | null>(null);
  const [progress, setProgress] = useState<Record<string, EpisodeProgress>>({});
  const [episodeData, setEpisodeData] = useState<Record<number, TmdbEpisode[]>>({});
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [loadingTv, setLoadingTv] = useState(isTv);
  const [isUpdating, setIsUpdating] = useState(false);
  const fetchedSeasonsRef = useRef<Set<number>>(new Set());

  const supabase = createClient();
  const { toast } = useToast();
  const effectiveTimestamp = getEffectiveTimestamp(item);

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

  const loadSeasonEpisodes = useCallback(async (seasonNum: number) => {
    if (!isTv || seasonNum <= 0) return;
    if (fetchedSeasonsRef.current.has(seasonNum)) return;
    fetchedSeasonsRef.current.add(seasonNum);
    setLoadingSeason(seasonNum);
    try {
      const res = await fetch(`/api/tmdb/media/tv/${media.tmdb_id}?season=${seasonNum}`);
      if (!res.ok) return;
      const data: TmdbSeason = await res.json();
      setEpisodeData((prev) => ({ ...prev, [seasonNum]: data.episodes ?? [] }));
    } catch {
      fetchedSeasonsRef.current.delete(seasonNum);
    } finally {
      setLoadingSeason((prev) => (prev === seasonNum ? null : prev));
    }
  }, [isTv, media.tmdb_id]);

  // Initial load of show details, episode_progress, and key seasons
  useEffect(() => {
    if (!isTv) return;
    let mounted = true;
    async function load() {
      try {
        const [showRes, { data: { user } }] = await Promise.all([
          fetch(`/api/tmdb/media/tv/${media.tmdb_id}`),
          supabase.auth.getUser(),
        ]);
        const show: TmdbTvDetails = await showRes.json();
        if (!mounted) return;
        setShowData(show);

        const map: Record<string, EpisodeProgress> = {};
        if (user) {
          const { data } = await supabase
            .from('episode_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('media_id', media.id);
          data?.forEach((ep) => {
            map[`${ep.season_number}-${ep.episode_number}`] = ep;
          });
          if (mounted) setProgress(map);
        }

        // Prefetch current season + latest season(s) so episode names and future air dates are immediately known
        const realSeasons = (show.seasons ?? [])
          .filter((s) => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number);

        const seasonsToPrefetch = new Set<number>();
        if (item.current_season > 0) seasonsToPrefetch.add(item.current_season);
        if (realSeasons.length > 0) {
          seasonsToPrefetch.add(realSeasons[0].season_number);
          seasonsToPrefetch.add(realSeasons[realSeasons.length - 1].season_number);
        }

        await Promise.all(Array.from(seasonsToPrefetch).map((sNum) => loadSeasonEpisodes(sNum)));
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoadingTv(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [media.id, media.tmdb_id, isTv, supabase, item.current_season, loadSeasonEpisodes]);

  // Compute aired vs upcoming episodes across all real seasons
  const realSeasons = showData?.seasons
    ? showData.seasons.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number)
    : [];

  let totalAiredEpisodes = 0;
  let totalAiredWatched = 0;
  let pausedAiredEpisode: { season: number; episode: number; name?: string; timestamp: string } | null = null;
  let nextAiredEpisode: { season: number; episode: number; name?: string; air_date: string | null } | null = null;
  let nextUpcomingEpisode: { season: number; episode: number; name?: string; air_date: string | null } | null = null;
  let lastAiredEpisode: { season: number; episode: number; name?: string } | null = null;

  for (const season of realSeasons) {
    const loadedEps = episodeData[season.season_number];
    if (loadedEps) {
      for (const ep of loadedEps) {
        const key = `${season.season_number}-${ep.episode_number}`;
        const epProg = progress[key];
        const aired = isEpisodeAired(ep.air_date);

        if (aired) {
          totalAiredEpisodes++;
          lastAiredEpisode = { season: season.season_number, episode: ep.episode_number, name: ep.name };
          if (epProg?.watched) {
            totalAiredWatched++;
          } else {
            if (!pausedAiredEpisode && epProg?.stopped_at_timestamp) {
              pausedAiredEpisode = {
                season: season.season_number,
                episode: ep.episode_number,
                name: ep.name,
                timestamp: epProg.stopped_at_timestamp,
              };
            }
            if (!nextAiredEpisode) {
              nextAiredEpisode = {
                season: season.season_number,
                episode: ep.episode_number,
                name: ep.name,
                air_date: ep.air_date,
              };
            }
          }
        } else if (!nextUpcomingEpisode) {
          nextUpcomingEpisode = {
            season: season.season_number,
            episode: ep.episode_number,
            name: ep.name,
            air_date: ep.air_date,
          };
        }
      }
    } else {
      // Season episodes not yet loaded: infer from season air_date when possible
      const seasonAired = season.air_date ? isEpisodeAired(season.air_date) : false;
      if (seasonAired) {
        totalAiredEpisodes += season.episode_count;
        for (let epNum = 1; epNum <= season.episode_count; epNum++) {
          const key = `${season.season_number}-${epNum}`;
          const epProg = progress[key];
          lastAiredEpisode = { season: season.season_number, episode: epNum };
          if (epProg?.watched) {
            totalAiredWatched++;
          } else {
            if (!pausedAiredEpisode && epProg?.stopped_at_timestamp) {
              pausedAiredEpisode = {
                season: season.season_number,
                episode: epNum,
                timestamp: epProg.stopped_at_timestamp,
              };
            }
            if (!nextAiredEpisode) {
              nextAiredEpisode = {
                season: season.season_number,
                episode: epNum,
                air_date: season.air_date,
              };
            }
          }
        }
      } else if (!nextUpcomingEpisode && season.episode_count > 0) {
        nextUpcomingEpisode = {
          season: season.season_number,
          episode: 1,
          air_date: season.air_date,
        };
      }
    }
  }

  // Ensure the active/next season is fetched so we have its exact episode names and air dates
  useEffect(() => {
    if (!isTv || loadingTv || !showData) return;
    const activeSeasonNum = pausedAiredEpisode?.season ?? nextAiredEpisode?.season;
    if (activeSeasonNum && !fetchedSeasonsRef.current.has(activeSeasonNum)) {
      loadSeasonEpisodes(activeSeasonNum).catch(() => {});
    }
  }, [isTv, loadingTv, showData, pausedAiredEpisode?.season, nextAiredEpisode?.season, loadSeasonEpisodes]);

  // Sync computed "Next up" / "Paused" state from episode_progress to watchlist table
  useEffect(() => {
    if (!isTv || loadingTv || !showData) return;

    let activeSeason = item.current_season;
    let activeEpisode = item.current_episode;
    let activeTimestamp: string | null = null;

    if (pausedAiredEpisode) {
      activeSeason = pausedAiredEpisode.season;
      activeEpisode = pausedAiredEpisode.episode;
      activeTimestamp = pausedAiredEpisode.timestamp;
    } else if (nextAiredEpisode) {
      activeSeason = nextAiredEpisode.season;
      activeEpisode = nextAiredEpisode.episode;
      activeTimestamp = null;
    } else if (lastAiredEpisode) {
      activeSeason = lastAiredEpisode.season;
      activeEpisode = lastAiredEpisode.episode;
      activeTimestamp = null;
    }

    if (
      activeSeason !== item.current_season ||
      activeEpisode !== item.current_episode ||
      activeTimestamp !== effectiveTimestamp
    ) {
      const runSync = async () => {
        setIsUpdating(true);
        try {
          await onProgressUpdate(item, activeSeason, activeEpisode, activeTimestamp || '', true);
        } catch (e) {
          console.error(e);
        } finally {
          setIsUpdating(false);
        }
      };
      runSync();
    }
  }, [
    isTv, loadingTv, showData, item, effectiveTimestamp,
    pausedAiredEpisode, nextAiredEpisode, lastAiredEpisode, onProgressUpdate
  ]);

  const overallPercentage = totalAiredEpisodes > 0
    ? Math.min(100, Math.round((totalAiredWatched / totalAiredEpisodes) * 100))
    : 0;
  const allAiredWatched = isTv && !loadingTv && totalAiredEpisodes > 0 && totalAiredWatched >= totalAiredEpisodes;

  // Resolve current active episode object for name & air-date checks
  const currentSeasonEps = episodeData[item.current_season];
  const currentEpObj = currentSeasonEps?.find((e) => e.episode_number === item.current_episode);
  const isCurrentEpAired = !isTv
    ? true
    : currentEpObj
      ? isEpisodeAired(currentEpObj.air_date)
      : !allAiredWatched;

  async function handleMarkCompleted() {
    if (isUpdating || (isTv && loadingTv)) return;
    if (isTv) {
      if (allAiredWatched || !isCurrentEpAired) {
        toast({
          title: 'Episode not available yet',
          description: 'You cannot mark an unaired episode as watched.',
          variant: 'destructive',
        });
        return;
      }

      setIsUpdating(true);
      try {
        const currentSeason = item.current_season;
        const currentEp = item.current_episode;
        const key = `${currentSeason}-${currentEp}`;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: epData, error: epError } = await supabase
          .from('episode_progress')
          .upsert({
            user_id: user.id,
            media_id: media.id,
            season_number: currentSeason,
            episode_number: currentEp,
            watched: true,
            watched_at: new Date().toISOString(),
            stopped_at_timestamp: null,
          }, { onConflict: 'user_id,media_id,season_number,episode_number' })
          .select()
          .single();

        if (epError) {
          toast({ title: 'Error marking episode watched', description: epError.message, variant: 'destructive' });
          return;
        }

        setProgress((prev) => ({ ...prev, [key]: epData }));
      } catch (err) {
        console.error(err);
      } finally {
        setIsUpdating(false);
      }
    } else {
      setIsUpdating(true);
      try {
        await onMarkMovieCompleted(item);
      } finally {
        setIsUpdating(false);
      }
    }
  }

  async function handleTimestampModalSave(ts: string, targetSeason?: number, targetEpisode?: number) {
    if (!isTv) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('movie_progress').upsert({
          user_id: user.id,
          media_id: media.id,
          watched: category === 'completed',
          stopped_at_timestamp: ts || null,
        }, { onConflict: 'user_id,media_id' });
      }
      await onProgressUpdate(item, 1, 1, ts);
      setShowTimestampModal(false);
      return;
    }

    const s = targetSeason ?? item.current_season;
    const e = targetEpisode ?? item.current_episode;

    // Ensure season episodes are checked for air date before saving
    const targetEpObj = episodeData[s]?.find((ep) => ep.episode_number === e);
    if (targetEpObj && !isEpisodeAired(targetEpObj.air_date)) {
      toast({
        title: 'Episode hasn’t aired yet',
        description: `S${s}E${e} is scheduled for ${formatAirDate(targetEpObj.air_date)} and cannot be logged yet.`,
        variant: 'destructive',
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Clear stopped_at_timestamp on any other paused episodes so this episode becomes the active one
    await supabase
      .from('episode_progress')
      .update({ stopped_at_timestamp: null })
      .eq('user_id', user.id)
      .eq('media_id', media.id)
      .not('stopped_at_timestamp', 'is', null);

    // If user jumped to a specific episode, ensure earlier aired episodes in loaded seasons are marked watched
    // so the sync effect selects (s, e) as the active episode even if ts is empty
    const episodesToMarkWatched: { season_number: number; episode_number: number }[] = [];
    for (const season of realSeasons) {
      if (season.season_number > s) break;
      const loaded = episodeData[season.season_number];
      const maxEp = season.season_number === s ? e - 1 : season.episode_count;
      for (let epNum = 1; epNum <= maxEp; epNum++) {
        const epInfo = loaded?.find((x) => x.episode_number === epNum);
        if (epInfo && !isEpisodeAired(epInfo.air_date)) continue;
        const key = `${season.season_number}-${epNum}`;
        if (!progress[key]?.watched) {
          episodesToMarkWatched.push({ season_number: season.season_number, episode_number: epNum });
        }
      }
    }

    if (episodesToMarkWatched.length > 0) {
      const nowIso = new Date().toISOString();
      await supabase.from('episode_progress').upsert(
        episodesToMarkWatched.map((ep) => ({
          user_id: user.id,
          media_id: media.id,
          season_number: ep.season_number,
          episode_number: ep.episode_number,
          watched: true,
          watched_at: nowIso,
          stopped_at_timestamp: null,
        })),
        { onConflict: 'user_id,media_id,season_number,episode_number' }
      );
    }

    // Upsert target episode with unwatched + new timestamp
    const { data: targetRow, error } = await supabase
      .from('episode_progress')
      .upsert({
        user_id: user.id,
        media_id: media.id,
        season_number: s,
        episode_number: e,
        watched: false,
        watched_at: null,
        stopped_at_timestamp: ts || null,
      }, { onConflict: 'user_id,media_id,season_number,episode_number' })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error saving progress', description: error.message, variant: 'destructive' });
      return;
    }

    // Reload episode_progress map cleanly
    const { data: refreshed } = await supabase
      .from('episode_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('media_id', media.id);

    const nextMap: Record<string, EpisodeProgress> = {};
    refreshed?.forEach((ep) => {
      nextMap[`${ep.season_number}-${ep.episode_number}`] = ep;
    });
    if (targetRow) {
      nextMap[`${s}-${e}`] = targetRow;
    }
    setProgress(nextMap);

    await onProgressUpdate(item, s, e, ts);
    setShowTimestampModal(false);
  }

  // Build aired season options for TimestampModal
  const modalSeasonOptions: SeasonOption[] = realSeasons
    .filter((s) => {
      const loaded = episodeData[s.season_number];
      if (loaded) return loaded.some((ep) => isEpisodeAired(ep.air_date));
      return s.air_date ? isEpisodeAired(s.air_date) : true;
    })
    .map((s) => {
      const loaded = episodeData[s.season_number];
      const airedCount = loaded
        ? loaded.filter((ep) => isEpisodeAired(ep.air_date)).length
        : s.episode_count;
      return {
        season_number: s.season_number,
        episode_count: Math.max(1, airedCount),
        name: s.name,
      };
    });

  const activeEpisodeDisplayName = pausedAiredEpisode?.name ?? currentEpObj?.name ?? nextAiredEpisode?.name;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card relative"
      style={{
        padding: 0,
        overflow: showMenu ? 'visible' : 'hidden',
        opacity: isDragging ? 0.5 : 1,
        zIndex: showMenu ? 30 : undefined,
      }}
    >
      {/* Header Info Block */}
      <div
        className={`flex gap-3 sm:gap-4 p-3.5 sm:p-4 transition-colors ${isTv ? 'cursor-pointer hover:bg-white/[0.01]' : ''}`}
        onClick={() => { if (isTv) setExpanded(!expanded); }}
      >
        {/* Drag handle */}
        <div
          className="hidden sm:flex items-center justify-center text-subtle hover:text-muted cursor-grab active:cursor-grabbing flex-shrink-0 pt-1 self-start"
          title="Drag to move category"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>

        {/* Poster */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 96, borderRadius: '0.625rem', overflow: 'hidden' }}>
          {media.poster_path ? (
            <Image
              src={posterUrl(media.poster_path, 'w185')}
              alt={media.title}
              fill
              sizes="64px"
              className="object-cover"
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
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate text-[15px]" style={{ color: 'hsl(var(--color-text))' }}>{media.title}</p>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {/* Progress / Next Up / Paused Badge (Issue #9 + Movie timestamp fix) */}
                  <span
                    className="badge flex items-center gap-1 font-bold text-[11px] whitespace-normal text-left normal-case"
                    style={{
                      background: !isTv
                        ? (effectiveTimestamp ? 'hsl(var(--color-accent) / 0.12)' : 'hsl(var(--color-surface-2))')
                        : effectiveTimestamp
                          ? 'hsl(var(--color-accent) / 0.12)'
                          : allAiredWatched
                            ? 'hsl(var(--color-success) / 0.12)'
                            : 'hsl(var(--color-brand) / 0.12)',
                      color: !isTv
                        ? (effectiveTimestamp ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-muted))')
                        : effectiveTimestamp
                          ? 'hsl(var(--color-accent))'
                          : allAiredWatched
                            ? 'hsl(var(--color-success))'
                            : 'hsl(var(--color-brand))',
                      border: `1px solid ${
                        !isTv
                          ? (effectiveTimestamp ? 'hsl(var(--color-accent) / 0.25)' : 'hsl(var(--color-border))')
                          : effectiveTimestamp
                            ? 'hsl(var(--color-accent) / 0.25)'
                            : allAiredWatched
                              ? 'hsl(var(--color-success) / 0.25)'
                              : 'hsl(var(--color-brand) / 0.25)'
                      }`,
                      borderRadius: '0.6rem',
                    }}
                  >
                    {effectiveTimestamp && <Clock size={11} className="mr-0.5 animate-pulse flex-shrink-0" />}
                    {(() => {
                      if (!isTv) {
                        if (category === 'completed') return 'Movie · Finished';
                        return effectiveTimestamp ? `Movie · Paused at ${effectiveTimestamp}` : 'Movie';
                      }

                      if (allAiredWatched) {
                        return 'All Caught Up! 🎉';
                      }

                      const epTitlePart = activeEpisodeDisplayName ? ` — "${activeEpisodeDisplayName}"` : '';

                      if (effectiveTimestamp) {
                        return `Paused: S${item.current_season}:E${item.current_episode}${epTitlePart} at ${effectiveTimestamp}`;
                      }

                      return `Next up: S${item.current_season}:E${item.current_episode}${epTitlePart}`;
                    })()}
                  </span>

                  {/* Upcoming Episode + Notification Flag Badge (Issue #8) */}
                  {isTv && !loadingTv && allAiredWatched && nextUpcomingEpisode && (
                    <span
                      className="badge flex items-center gap-1 font-semibold text-[11px] whitespace-normal text-left normal-case"
                      style={{
                        background: 'hsl(var(--color-warning) / 0.12)',
                        color: 'hsl(var(--color-warning))',
                        border: '1px solid hsl(var(--color-warning) / 0.25)',
                        borderRadius: '0.6rem',
                      }}
                    >
                      <CalendarClock size={11} className="flex-shrink-0" />
                      <span>
                        S{nextUpcomingEpisode.season}E{nextUpcomingEpisode.episode}
                        {nextUpcomingEpisode.name ? ` "${nextUpcomingEpisode.name}"` : ''} ·{' '}
                        {nextUpcomingEpisode.air_date ? `Airs ${formatAirDate(nextUpcomingEpisode.air_date)}` : 'TBA'}
                      </span>
                      <Bell size={11} className="flex-shrink-0 ml-0.5" aria-label="Flagged for notification" />
                    </span>
                  )}

                  {/* Movie Rating */}
                  {!isTv && media.vote_average > 0 && (
                    <StarRating rating={media.vote_average} size="sm" />
                  )}

                  {/* TV Overall Progress Bar in Card Header */}
                  {isTv && !loadingTv && showData && (
                    <div className="flex items-center gap-1.5" style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
                      <StarRating rating={showData.vote_average} size="sm" />
                      <div style={{
                        width: 64,
                        height: 5,
                        background: 'hsl(var(--color-surface-3))',
                        borderRadius: 99,
                        overflow: 'hidden',
                        position: 'relative',
                        border: '1px solid hsl(var(--color-border) / 0.3)'
                      }}>
                        <div style={{
                          width: `${overallPercentage}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, hsl(var(--color-brand)) 0%, hsl(var(--color-accent)) 100%)',
                          borderRadius: 99,
                          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                      </div>
                      <span className="text-[10px] font-bold text-subtle whitespace-nowrap">
                        {overallPercentage}% ({totalAiredWatched}/{totalAiredEpisodes})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Category / Options Menu */}
              <div className="relative flex-shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="btn btn-ghost p-1.5"
                  aria-label="Move or remove title"
                  style={{ borderRadius: '0.5rem', minWidth: 0 }}
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-40 rounded-xl overflow-hidden animate-scale-in"
                    style={{
                      background: 'hsl(var(--color-surface-2))',
                      border: '1px solid hsl(var(--color-border))',
                      minWidth: 200,
                      boxShadow: 'var(--shadow-card), 0 10px 30px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">
                      Move to category
                    </div>
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      const isCurrent = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          disabled={isCurrent}
                          onClick={() => { onMoveCategory(cat.id); setShowMenu(false); }}
                          className="flex items-center justify-between gap-2 w-full px-3.5 py-2 text-xs text-left hover:bg-white/[0.04] transition-all"
                          style={{
                            color: isCurrent ? cat.accentColor : 'hsl(var(--color-text))',
                            background: isCurrent ? 'hsl(var(--color-brand) / 0.08)' : 'transparent',
                            border: 'none',
                            cursor: isCurrent ? 'default' : 'pointer',
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <CatIcon size={13} style={{ color: cat.accentColor }} />
                            {cat.label}
                          </span>
                          {isCurrent && <Check size={12} />}
                        </button>
                      );
                    })}
                    <div style={{ height: 1, background: 'hsl(var(--color-border))', margin: '0.25rem 0' }} />
                    <button
                      onClick={() => { onMoveToWatchlist(); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-left hover:bg-white/[0.04] transition-all"
                      style={{ color: 'hsl(var(--color-text-muted))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <List size={13} />
                      Move to Watchlist
                    </button>
                    <button
                      onClick={() => { onRemove(); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-left hover:bg-white/[0.04] transition-all"
                      style={{ color: 'hsl(var(--color-error))', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Face Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTimestampModal(true)}
              disabled={isUpdating || (isTv && loadingTv)}
              className="btn btn-ghost text-xs flex items-center gap-1"
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                opacity: (isUpdating || (isTv && loadingTv)) ? 0.5 : 1,
                cursor: (isUpdating || (isTv && loadingTv)) ? 'not-allowed' : 'pointer'
              }}
            >
              <Clock size={13} />
              Update Progress
            </button>
            <button
              onClick={handleMarkCompleted}
              disabled={isUpdating || (isTv && loadingTv) || allAiredWatched || !isCurrentEpAired || (!isTv && category === 'completed')}
              className="btn text-xs flex items-center gap-1 transition-transform"
              style={{
                padding: '0.4rem 0.75rem',
                background: (allAiredWatched || !isCurrentEpAired || (!isTv && category === 'completed'))
                  ? 'hsl(var(--color-surface-3))'
                  : (isUpdating || (isTv && loadingTv))
                    ? 'hsl(var(--color-surface-2))'
                    : 'hsl(var(--color-success) / 0.1)',
                color: (allAiredWatched || !isCurrentEpAired || (!isTv && category === 'completed'))
                  ? 'hsl(var(--color-text-muted))'
                  : (isUpdating || (isTv && loadingTv))
                    ? 'hsl(var(--color-text-subtle))'
                    : 'hsl(var(--color-success))',
                border: `1px solid ${
                  (allAiredWatched || !isCurrentEpAired || (!isTv && category === 'completed'))
                    ? 'hsl(var(--color-border))'
                    : (isUpdating || (isTv && loadingTv))
                      ? 'hsl(var(--color-border) / 0.5)'
                      : 'hsl(var(--color-success) / 0.2)'
                }`,
                borderRadius: '0.5rem',
                cursor: (isUpdating || (isTv && loadingTv) || allAiredWatched || !isCurrentEpAired || (!isTv && category === 'completed'))
                  ? 'not-allowed'
                  : 'pointer',
                opacity: (isUpdating || (isTv && loadingTv)) ? 0.7 : 1,
              }}
            >
              {isUpdating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (allAiredWatched || (!isTv && category === 'completed')) ? (
                <CheckCircle2 size={13} />
              ) : !isCurrentEpAired ? (
                <Lock size={13} />
              ) : (
                <CheckCircle2 size={13} />
              )}
              {isTv
                ? allAiredWatched
                  ? 'All Caught Up 🎉'
                  : !isCurrentEpAired
                    ? 'Not Yet Aired'
                    : isUpdating
                      ? 'Updating...'
                      : 'Mark Episode Watched'
                : category === 'completed'
                  ? 'Finished 🎉'
                  : 'Mark Completed'}
            </button>
          </div>

          {/* Expand episodes label for TV */}
          {isTv && (
            <div className="mt-2.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-subtle">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? 'Hide full details' : 'View all episodes'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Episode list for TV */}
      {isTv && showData && (
        <div
          className={`collapsible-grid ${expanded ? 'expanded' : ''}`}
          style={{
            borderTop: expanded ? '1px solid hsl(var(--color-border))' : '1px solid transparent',
            transition: 'border-color 0.3s, grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div className="collapsible-inner">
            <EpisodeList
              mediaId={media.id}
              showData={showData}
              progress={progress}
              setProgress={setProgress}
              episodeData={episodeData}
              loadingSeason={loadingSeason}
              loadSeasonEpisodes={loadSeasonEpisodes}
            />
          </div>
        </div>
      )}

      {/* Render TimestampModal */}
      {showTimestampModal && (
        <TimestampModal
          current={effectiveTimestamp ?? ''}
          label={media.title}
          isTv={isTv}
          currentSeason={item.current_season}
          currentEpisode={item.current_episode}
          seasons={isTv ? modalSeasonOptions : undefined}
          onClose={() => setShowTimestampModal(false)}
          onSave={handleTimestampModalSave}
        />
      )}
    </div>
  );
}

// ── EpisodeList ────────────────────────────────────────────────
function EpisodeList({
  mediaId,
  showData,
  progress,
  setProgress,
  episodeData,
  loadingSeason,
  loadSeasonEpisodes,
}: {
  mediaId: string;
  showData: TmdbTvDetails;
  progress: Record<string, EpisodeProgress>;
  setProgress: React.Dispatch<React.SetStateAction<Record<string, EpisodeProgress>>>;
  episodeData: Record<number, TmdbEpisode[]>;
  loadingSeason: number | null;
  loadSeasonEpisodes: (seasonNum: number) => Promise<void>;
}) {
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  async function toggleEpisode(seasonNum: number, ep: TmdbEpisode) {
    if (!isEpisodeAired(ep.air_date)) {
      toast({
        title: 'Episode not available yet',
        description: `S${seasonNum}E${ep.episode_number} airs ${formatAirDate(ep.air_date)}.`,
        variant: 'destructive',
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = `${seasonNum}-${ep.episode_number}`;
    const existing = progress[key];
    const newWatched = !existing?.watched;
    const { data, error } = await supabase
      .from('episode_progress')
      .upsert({
        user_id: user.id,
        media_id: mediaId,
        season_number: seasonNum,
        episode_number: ep.episode_number,
        watched: newWatched,
        watched_at: newWatched ? new Date().toISOString() : null,
        stopped_at_timestamp: newWatched ? null : existing?.stopped_at_timestamp,
      }, { onConflict: 'user_id,media_id,season_number,episode_number' })
      .select()
      .single();

    if (error) {
      toast({ title: 'Could not update episode', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) {
      setProgress((prev) => ({ ...prev, [key]: data }));
    }
  }

  const realSeasons = showData.seasons.filter((s) => s.season_number > 0);

  return (
    <div>
      {realSeasons.map((season) => {
        const isOpen = openSeason === season.season_number;
        const eps = episodeData[season.season_number] ?? [];

        const airedEps = eps.length > 0
          ? eps.filter((e) => isEpisodeAired(e.air_date))
          : null;
        const totalInSeason = airedEps ? airedEps.length : season.episode_count;

        const watchedCount = Object.values(progress).filter(
          (ep) => ep.season_number === season.season_number && ep.watched
        ).length;
        const percentage = totalInSeason > 0
          ? Math.min(100, Math.round((watchedCount / totalInSeason) * 100))
          : 0;

        return (
          <div key={season.season_number} style={{ borderBottom: '1px solid hsl(var(--color-border) / 0.5)' }}>
            <button
              onClick={() => {
                if (!isOpen) {
                  setOpenSeason(season.season_number);
                  loadSeasonEpisodes(season.season_number).catch(() => {});
                } else {
                  setOpenSeason(null);
                }
              }}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm transition-all hover:bg-white/[0.02]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text))' }}
            >
              <div className="flex flex-col items-start gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-left">{season.name}</span>
                  {(season.vote_average ?? 0) > 0 && (
                    <StarRating rating={season.vote_average} size="sm" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div style={{
                    width: 100,
                    height: 6,
                    background: 'hsl(var(--color-surface-3))',
                    borderRadius: 99,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, hsl(var(--color-brand)) 0%, hsl(var(--color-accent)) 100%)',
                      borderRadius: 99,
                      transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                  <span className="text-[10px] font-bold text-subtle" style={{ minWidth: 28, textAlign: 'left' }}>{percentage}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <span className="text-xs" style={{ color: 'hsl(var(--color-text-muted))' }}>
                  {watchedCount}/{totalInSeason} aired
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            <div className={`collapsible-grid ${isOpen ? 'expanded' : ''}`}>
              <div className="collapsible-inner" style={{ padding: isOpen ? '0 1rem 1rem' : '0 1rem' }}>
                {loadingSeason === season.season_number && eps.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-subtle" />
                  </div>
                ) : eps.length === 0 ? (
                  <p className="text-subtle text-sm pt-2">No episodes found.</p>
                ) : (
                  eps.map((ep) => (
                    <EpisodeRow
                      key={ep.episode_number}
                      episode={ep}
                      seasonNum={season.season_number}
                      mediaId={mediaId}
                      progress={progress[`${season.season_number}-${ep.episode_number}`]}
                      onToggle={() => toggleEpisode(season.season_number, ep)}
                      onProgressUpdate={(updated) => setProgress((prev) => ({
                        ...prev,
                        [`${season.season_number}-${ep.episode_number}`]: updated,
                      }))}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── EpisodeRow ─────────────────────────────────────────────────
function EpisodeRow({
  episode,
  seasonNum,
  mediaId,
  progress,
  onToggle,
  onProgressUpdate,
}: {
  episode: TmdbEpisode;
  seasonNum: number;
  mediaId: string;
  progress: EpisodeProgress | undefined;
  onToggle: () => void;
  onProgressUpdate: (p: EpisodeProgress) => void;
}) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const supabase = createClient();
  const aired = isEpisodeAired(episode.air_date);
  const watched = aired && (progress?.watched ?? false);

  return (
    <div
      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 py-2.5 rounded-lg px-2 -mx-2 transition-all animate-slide-up"
      style={{
        background: watched ? 'hsl(var(--color-success) / 0.05)' : 'transparent',
        opacity: aired ? 1 : 0.78,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Watched checkbox (disabled for unaired episodes) */}
        <button
          onClick={onToggle}
          disabled={!aired}
          aria-label={
            aired
              ? `Mark S${seasonNum}E${episode.episode_number} as ${watched ? 'unwatched' : 'watched'}`
              : `S${seasonNum}E${episode.episode_number} has not aired yet`
          }
          title={aired ? undefined : `Airs ${formatAirDate(episode.air_date)}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: aired ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: !aired
              ? 'hsl(var(--color-surface-2))'
              : watched
                ? 'hsl(var(--color-success))'
                : 'transparent',
            border: `2px solid ${
              !aired
                ? 'hsl(var(--color-border) / 0.6)'
                : watched
                  ? 'hsl(var(--color-success))'
                  : 'hsl(var(--color-border))'
            }`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}>
            {!aired ? (
              <Lock size={9} style={{ color: 'hsl(var(--color-text-subtle))' }} />
            ) : (
              watched && <Check size={10} color="#fff" strokeWidth={3} />
            )}
          </div>
        </button>

        {/* Episode info */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{
              color: watched ? 'hsl(var(--color-text-muted))' : 'hsl(var(--color-text))',
              textDecoration: watched ? 'line-through' : 'none',
            }}
          >
            <span className="text-subtle mr-1">E{episode.episode_number.toString().padStart(2, '0')}</span>
            {episode.name}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {aired ? (
              <>
                {episode.air_date && (
                  <span className="text-xs text-subtle">{formatAirDate(episode.air_date)}</span>
                )}
                {episode.vote_average > 0 && (
                  <StarRating rating={episode.vote_average} size="sm" />
                )}
              </>
            ) : (
              <>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'hsl(var(--color-warning) / 0.14)',
                    color: 'hsl(var(--color-warning))',
                    border: '1px solid hsl(var(--color-warning) / 0.28)',
                  }}
                >
                  <CalendarClock size={10} />
                  Upcoming · {formatAirDate(episode.air_date)}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'hsl(var(--color-info) / 0.12)',
                    color: 'hsl(var(--color-info))',
                    border: '1px solid hsl(var(--color-info) / 0.25)',
                  }}
                  title="You will receive a notification when this episode drops"
                >
                  <Bell size={10} />
                  Notify on release
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timestamp button (only for aired episodes) */}
      {aired && (
        <button
          onClick={() => setShowTimestamp(true)}
          className="flex items-center gap-1 text-xs flex-shrink-0 pl-7 sm:pl-0"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: progress?.stopped_at_timestamp ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-subtle))',
          }}
          aria-label="Set stopped timestamp"
        >
          <Clock size={12} />
          {progress?.stopped_at_timestamp ?? 'Set timestamp'}
        </button>
      )}

      {showTimestamp && aired && (
        <TimestampModal
          current={progress?.stopped_at_timestamp ?? ''}
          label={`S${seasonNum}E${episode.episode_number} — ${episode.name}`}
          onClose={() => setShowTimestamp(false)}
          onSave={async (ts) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
              .from('episode_progress')
              .upsert({
                user_id: user.id,
                media_id: mediaId,
                season_number: seasonNum,
                episode_number: episode.episode_number,
                watched: progress?.watched ?? false,
                stopped_at_timestamp: ts || null,
              }, { onConflict: 'user_id,media_id,season_number,episode_number' })
              .select()
              .single();
            if (data) onProgressUpdate(data);
            setShowTimestamp(false);
          }}
        />
      )}
    </div>
  );
}
