'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Loader2, Film, Tv, ChevronDown, ChevronUp, Check, Clock,
  Trash2, MoreHorizontal
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Watchlist, EpisodeProgress, MovieProgress, TmdbTvDetails, TmdbSeason, TmdbEpisode, WatchlistStatus } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';
import { useToast } from '@/hooks/use-toast';
import TimestampModal from '@/components/progress/timestamp-modal';

const STATUS_LABELS: Record<WatchlistStatus, string> = {
  to_watch: 'To Watch',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
};

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

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  async function updateStatus(watchlistId: string, status: WatchlistStatus) {
    await supabase.from('watchlist').update({ status }).eq('id', watchlistId);
    // Remove from Watchlist view since its status is no longer 'to_watch'
    setItems((prev) => prev.filter((i) => i.id !== watchlistId));
    toast({ title: 'Status updated' });
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
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const media = item.media!;
  const isTv = media.media_type === 'tv';

  const [showData, setShowData] = useState<TmdbTvDetails | null>(null);
  const [progress, setProgress] = useState<Record<string, EpisodeProgress>>({});
  const [loadingTv, setLoadingTv] = useState(isTv);
  const supabase = createClient();

  useEffect(() => {
    if (!isTv) return;
    async function load() {
      const [showRes, { data: { user } }] = await Promise.all([
        fetch(`/api/tmdb/media/tv/${media.tmdb_id}`),
        supabase.auth.getUser(),
      ]);
      const show: TmdbTvDetails = await showRes.json();
      setShowData(show);

      if (user) {
        const { data } = await supabase
          .from('episode_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('media_id', media.id);
        const map: Record<string, EpisodeProgress> = {};
        data?.forEach((ep) => {
          map[`${ep.season_number}-${ep.episode_number}`] = ep;
        });
        setProgress(map);
      }
      setLoadingTv(false);
    }
    load();
  }, [media.id, media.tmdb_id, isTv, supabase]);

  // Calculate overall show progress stats
  const totalEpisodes = showData?.number_of_episodes || 0;
  const totalWatched = Object.values(progress).filter((ep) => ep.watched).length;
  const overallPercentage = totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header row */}
      <div
        className={`flex gap-4 p-4 transition-colors ${isTv ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
        onClick={() => {
          if (isTv) setExpanded(!expanded);
        }}
      >
        {/* Poster thumbnail */}
        <div className="relative flex-shrink-0" style={{ width: 56, height: 84, borderRadius: '0.5rem', overflow: 'hidden' }}>
          {media.poster_path ? (
            <Image
              src={posterUrl(media.poster_path, 'w185')}
              alt={media.title}
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--color-surface-2))' }}>
              {isTv ? <Tv size={20} style={{ color: 'hsl(var(--color-border))' }} /> : <Film size={20} style={{ color: 'hsl(var(--color-border))' }} />}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight truncate">{media.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="badge" style={{
                  background: isTv ? 'hsl(var(--color-brand) / 0.15)' : 'hsl(var(--color-accent) / 0.15)',
                  color: isTv ? 'hsl(var(--color-brand))' : 'hsl(var(--color-accent))',
                }}>
                  {isTv ? 'TV' : 'Movie'}
                </span>
                
                {/* Overall Show Progress in Card Header */}
                {isTv && !loadingTv && showData && (
                  <div className="flex items-center gap-1.5" style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{
                      width: 80,
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
                    <span className="text-[10px] font-bold text-subtle">
                      {overallPercentage}% ({totalWatched}/{totalEpisodes})
                    </span>
                  </div>
                )}
                {isTv && loadingTv && (
                  <div className="skeleton" style={{ height: 10, width: 120 }} />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <StatusDropdown status={item.status} onChange={(s) => onStatusChange(item.id, s)} />
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

          {/* Expand button for TV */}
          {isTv && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-1 text-xs mt-2.5 transition-all"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text-muted))', padding: 0 }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Hide episodes' : 'Track episodes'}
            </button>
          )}

          {/* Movie progress */}
          {!isTv && (
            <div onClick={(e) => e.stopPropagation()}>
              <MovieProgressRow mediaId={media.id} />
            </div>
          )}
        </div>
      </div>

      {/* Episode list for TV */}
      {isTv && expanded && showData && (
        <EpisodeList
          mediaId={media.id}
          tmdbId={media.tmdb_id}
          showData={showData}
          progress={progress}
          setProgress={setProgress}
        />
      )}
    </div>
  );
}

// ── StatusDropdown ─────────────────────────────────────────────
function StatusDropdown({ status, onChange }: { status: WatchlistStatus; onChange: (s: WatchlistStatus) => void }) {
  const [open, setOpen] = useState(false);
  const statuses: WatchlistStatus[] = ['to_watch', 'watching', 'completed', 'dropped'];
  const badgeClass = `badge badge-${status.replace('_', '-')}`;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={badgeClass} style={{ cursor: 'pointer', border: 'none' }}>
        {STATUS_LABELS[status]}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden"
          style={{ background: 'hsl(var(--color-surface-2))', border: '1px solid hsl(var(--color-border))', minWidth: 140 }}
        >
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-all"
              style={{ background: s === status ? 'hsl(var(--color-surface-3))' : 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text))' }}
            >
              {s === status && <Check size={12} />}
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MovieProgressRow ───────────────────────────────────────────
function MovieProgressRow({ mediaId }: { mediaId: string }) {
  const [progress, setProgress] = useState<MovieProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('movie_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('media_id', mediaId)
        .maybeSingle();
      setProgress(data);
      setLoading(false);
    }
    load();
  }, [mediaId, supabase]);

  async function toggleWatched() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newWatched = !progress?.watched;
    const { data } = await supabase
      .from('movie_progress')
      .upsert({
        user_id: user.id,
        media_id: mediaId,
        watched: newWatched,
        watched_at: newWatched ? new Date().toISOString() : null,
        stopped_at_timestamp: newWatched ? null : progress?.stopped_at_timestamp,
      }, { onConflict: 'user_id,media_id' })
      .select()
      .single();
    setProgress(data);
  }

  if (loading) return <div className="skeleton mt-2" style={{ height: 24, width: 120 }} />;

  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        onClick={toggleWatched}
        className="flex items-center gap-1.5 text-xs btn btn-ghost"
        style={{ padding: '0.3rem 0.75rem', borderRadius: '99px' }}
      >
        <div
          style={{
            width: 16, height: 16, borderRadius: '50%',
            background: progress?.watched ? 'hsl(var(--color-success))' : 'transparent',
            border: `2px solid ${progress?.watched ? 'hsl(var(--color-success))' : 'hsl(var(--color-border))'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {progress?.watched && <Check size={9} color="#fff" strokeWidth={3} />}
        </div>
        {progress?.watched ? 'Watched' : 'Mark Watched'}
      </button>
      <button
        onClick={() => setShowTimestamp(true)}
        className="flex items-center gap-1 text-xs"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text-muted))' }}
        aria-label="Set timestamp"
      >
        <Clock size={12} />
        {progress?.stopped_at_timestamp ?? 'Set timestamp'}
      </button>
      {showTimestamp && (
        <TimestampModal
          current={progress?.stopped_at_timestamp ?? ''}
          label="Movie"
          onClose={() => setShowTimestamp(false)}
          onSave={async (ts) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
              .from('movie_progress')
              .upsert({ user_id: user.id, media_id: mediaId, stopped_at_timestamp: ts || null }, { onConflict: 'user_id,media_id' })
              .select().single();
            setProgress(data);
            setShowTimestamp(false);
          }}
        />
      )}
    </div>
  );
}

// ── EpisodeList ────────────────────────────────────────────────
function EpisodeList({
  mediaId,
  tmdbId,
  showData,
  progress,
  setProgress,
}: {
  mediaId: string;
  tmdbId: number;
  showData: TmdbTvDetails;
  progress: Record<string, EpisodeProgress>;
  setProgress: React.Dispatch<React.SetStateAction<Record<string, EpisodeProgress>>>;
}) {
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [episodeData, setEpisodeData] = useState<Record<number, TmdbEpisode[]>>({});
  const supabase = createClient();

  async function loadSeasonEpisodes(seasonNum: number) {
    if (episodeData[seasonNum]) return;
    const res = await fetch(`/api/tmdb/media/tv/${tmdbId}?season=${seasonNum}`);
    const data: TmdbSeason = await res.json();
    setEpisodeData((prev) => ({ ...prev, [seasonNum]: data.episodes ?? [] }));
  }

  async function toggleEpisode(seasonNum: number, epNum: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = `${seasonNum}-${epNum}`;
    const existing = progress[key];
    const newWatched = !existing?.watched;
    const { data } = await supabase
      .from('episode_progress')
      .upsert({
        user_id: user.id,
        media_id: mediaId,
        season_number: seasonNum,
        episode_number: epNum,
        watched: newWatched,
        watched_at: newWatched ? new Date().toISOString() : null,
        stopped_at_timestamp: newWatched ? null : existing?.stopped_at_timestamp,
      }, { onConflict: 'user_id,media_id,season_number,episode_number' })
      .select().single();
    setProgress((prev) => ({ ...prev, [key]: data }));
  }

  const realSeasons = showData.seasons.filter((s) => s.season_number > 0);

  return (
    <div style={{ borderTop: '1px solid hsl(var(--color-border))' }}>
      {realSeasons.map((season) => {
        const isOpen = openSeason === season.season_number;
        const eps = episodeData[season.season_number] ?? [];
        
        const watchedCount = Object.values(progress).filter(
          (ep) => ep.season_number === season.season_number && ep.watched
        ).length;
        const percentage = season.episode_count ? Math.round((watchedCount / season.episode_count) * 100) : 0;

        return (
          <div key={season.season_number} style={{ borderBottom: '1px solid hsl(var(--color-border) / 0.5)' }}>
            <button
              onClick={async () => {
                if (!isOpen) await loadSeasonEpisodes(season.season_number);
                setOpenSeason(isOpen ? null : season.season_number);
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm transition-all hover:bg-white/[0.02]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text))' }}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">{season.name}</span>
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
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'hsl(var(--color-text-muted))' }}>
                  {watchedCount}/{season.episode_count} ep{season.episode_count !== 1 ? 's' : ''}
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: '0 1rem 1rem' }}>
                {eps.length === 0 ? (
                  <p className="text-subtle text-sm">No episodes found.</p>
                ) : (
                  eps.map((ep) => (
                    <EpisodeRow
                      key={ep.episode_number}
                      episode={ep}
                      seasonNum={season.season_number}
                      mediaId={mediaId}
                      progress={progress[`${season.season_number}-${ep.episode_number}`]}
                      onToggle={() => toggleEpisode(season.season_number, ep.episode_number)}
                      onProgressUpdate={(updated) => setProgress((prev) => ({
                        ...prev,
                        [`${season.season_number}-${ep.episode_number}`]: updated,
                      }))}
                    />
                  ))
                )}
              </div>
            )}
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
  const watched = progress?.watched ?? false;

  return (
    <div
      className="flex items-center gap-3 py-2 rounded-lg px-2 -mx-2 transition-all"
      style={{ background: watched ? 'hsl(var(--color-success) / 0.05)' : 'transparent' }}
    >
      {/* Watched checkbox */}
      <button
        onClick={onToggle}
        aria-label={`Mark S${seasonNum}E${episode.episode_number} as ${watched ? 'unwatched' : 'watched'}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: watched ? 'hsl(var(--color-success))' : 'transparent',
          border: `2px solid ${watched ? 'hsl(var(--color-success))' : 'hsl(var(--color-border))'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
        }}>
          {watched && <Check size={10} color="#fff" strokeWidth={3} />}
        </div>
      </button>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: watched ? 'hsl(var(--color-text-muted))' : 'hsl(var(--color-text))', textDecoration: watched ? 'line-through' : 'none' }}>
          <span className="text-subtle mr-1">E{episode.episode_number.toString().padStart(2, '0')}</span>
          {episode.name}
        </p>
        {episode.air_date && (
          <p className="text-xs text-subtle">{new Date(episode.air_date).toLocaleDateString()}</p>
        )}
      </div>

      {/* Timestamp button */}
      <button
        onClick={() => setShowTimestamp(true)}
        className="flex items-center gap-1 text-xs flex-shrink-0"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: progress?.stopped_at_timestamp ? 'hsl(var(--color-accent))' : 'hsl(var(--color-text-subtle))',
        }}
        aria-label="Set stopped timestamp"
      >
        <Clock size={12} />
        {progress?.stopped_at_timestamp ?? ''}
      </button>

      {showTimestamp && (
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
              .select().single();
            onProgressUpdate(data);
            setShowTimestamp(false);
          }}
        />
      )}
    </div>
  );
}
