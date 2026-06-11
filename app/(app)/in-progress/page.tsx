'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Clock, Loader2, CheckCircle2, Tv, Film, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import StarRating from '@/components/ui/star-rating';
import { createClient } from '@/lib/supabase/client';
import { Watchlist, EpisodeProgress, TmdbTvDetails, TmdbSeason, TmdbEpisode } from '@/lib/types';
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
      // For TV: increment episode
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
      // For Movie: set status to completed
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
          {items.length === 0 ? 'Nothing in progress right now.' : `${items.length} title${items.length !== 1 ? 's' : ''} actively being tracked.`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">Nothing in progress</p>
          <p className="text-subtle text-sm mt-1">Start watching a show or movie from Search or Watchlist to track progress here.</p>
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
  const [expanded, setExpanded] = useState(false);
  const media = item.media!;
  const isTv = media.media_type === 'tv';

  const [showData, setShowData] = useState<TmdbTvDetails | null>(null);
  const [progress, setProgress] = useState<Record<string, EpisodeProgress>>({});
  const [loadingTv, setLoadingTv] = useState(isTv);
  const [isUpdating, setIsUpdating] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  async function handleMarkCompleted() {
    if (isUpdating || (isTv && loadingTv)) return;
    setIsUpdating(true);
    try {
      if (isTv) {
        const currentSeason = item.current_season;
        const currentEp = item.current_episode;
        const key = `${currentSeason}-${currentEp}`;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Upsert into episode_progress table as watched
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

        // 2. Update local checklist state so checklists/progress bars update in real time
        setProgress((prev) => ({ ...prev, [key]: epData }));
      } else {
        await onMarkCompleted(item);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    if (!isTv) return;
    async function load() {
      try {
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTv(false);
      }
    }
    load();
  }, [media.id, media.tmdb_id, isTv, supabase]);

  // Sync computed "Next up" and "Paused" state from progress to the watchlist table in the DB
  useEffect(() => {
    if (!isTv || loadingTv || !showData) return;

    let activeSeason = item.current_season;
    let activeEpisode = item.current_episode;
    let activeTimestamp: string | null = null;

    let foundPaused = false;
    const realSeasons = showData.seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number);

    // 1. First, search for any episode that is NOT watched and HAS a stopped_at_timestamp set (mid-episode)
    for (const season of realSeasons) {
      for (let epNum = 1; epNum <= season.episode_count; epNum++) {
        const key = `${season.season_number}-${epNum}`;
        const epProgress = progress[key];
        if (epProgress && !epProgress.watched && epProgress.stopped_at_timestamp) {
          activeSeason = season.season_number;
          activeEpisode = epNum;
          activeTimestamp = epProgress.stopped_at_timestamp;
          foundPaused = true;
          break;
        }
      }
      if (foundPaused) break;
    }

    // 2. If no paused episode found, find the first unwatched episode in order
    if (!foundPaused) {
      let foundUnwatched = false;
      for (const season of realSeasons) {
        for (let epNum = 1; epNum <= season.episode_count; epNum++) {
          const key = `${season.season_number}-${epNum}`;
          const epProgress = progress[key];
          if (!epProgress || !epProgress.watched) {
            activeSeason = season.season_number;
            activeEpisode = epNum;
            activeTimestamp = null;
            foundUnwatched = true;
            break;
          }
        }
        if (foundUnwatched) break;
      }

      // 3. If all episodes are watched, default to the last episode of the last season
      if (!foundUnwatched && realSeasons.length > 0) {
        const lastSeason = realSeasons[realSeasons.length - 1];
        activeSeason = lastSeason.season_number;
        activeEpisode = lastSeason.episode_count;
        activeTimestamp = null;
      }
    }

    // Only update if the computed next/paused episode differs from the current item's state
    if (
      activeSeason !== item.current_season ||
      activeEpisode !== item.current_episode ||
      activeTimestamp !== item.last_timestamp
    ) {
      const runSync = async () => {
        setIsUpdating(true);
        try {
          await onProgressUpdate(item, activeSeason, activeEpisode, activeTimestamp || '');
        } catch (e) {
          console.error(e);
        } finally {
          setIsUpdating(false);
        }
      };
      runSync();
    }
  }, [progress, showData, loadingTv, isTv, item, onProgressUpdate]);

  // Calculate overall show progress stats
  const totalEpisodes = showData
    ? showData.seasons.filter((s) => s.season_number > 0).reduce((acc, s) => acc + s.episode_count, 0)
    : 0;
  const totalWatched = Object.values(progress).filter((ep) => ep.watched && ep.season_number > 0).length;
  const overallPercentage = totalEpisodes > 0 ? Math.min(100, Math.round((totalWatched / totalEpisodes) * 100)) : 0;
  const allWatched = isTv && !loadingTv && totalEpisodes > 0 && totalWatched === totalEpisodes;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header Info Block */}
      <div 
        className={`flex gap-4 p-4 transition-colors ${isTv ? 'cursor-pointer hover:bg-white/[0.01]' : ''}`}
        onClick={() => { if (isTv) setExpanded(!expanded); }}
      >
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
                      background: !isTv 
                        ? 'hsl(var(--color-accent) / 0.12)' 
                        : item.last_timestamp 
                          ? 'hsl(var(--color-accent) / 0.12)' 
                          : 'hsl(var(--color-brand) / 0.12)',
                      color: !isTv 
                        ? 'hsl(var(--color-accent))' 
                        : item.last_timestamp 
                          ? 'hsl(var(--color-accent))' 
                          : 'hsl(var(--color-brand))',
                      border: `1px solid ${
                        !isTv 
                          ? 'hsl(var(--color-accent) / 0.2)' 
                          : item.last_timestamp 
                            ? 'hsl(var(--color-accent) / 0.2)' 
                            : 'hsl(var(--color-brand) / 0.2)'
                      }`
                    }}
                  >
                    {isTv && item.last_timestamp && <Clock size={11} className="mr-0.5 animate-pulse" />}
                    {(() => {
                      if (!isTv) return 'Movie';
                      
                      const allWatched = showData && !loadingTv && 
                        Object.values(progress).filter((ep) => ep.watched).length === totalEpisodes && 
                        totalEpisodes > 0;

                      if (allWatched) {
                        return 'All Caught Up! 🎉';
                      }

                      if (item.last_timestamp) {
                        return `Paused: Season ${item.current_season}: Episode ${item.current_episode} at ${item.last_timestamp}`;
                      }

                      return `Next up : Season ${item.current_season}: Episode ${item.current_episode}`;
                    })()}
                  </span>

                  {/* Movie Rating */}
                  {!isTv && media.vote_average > 0 && (
                    <StarRating rating={media.vote_average} size="sm" />
                  )}

                  {/* TV Overall Progress Bar in Card Header */}
                  {isTv && !loadingTv && showData && (
                    <div className="flex items-center gap-1.5 ml-1" style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
                      <StarRating rating={showData.vote_average} size="sm" />
                      <div style={{
                        width: 70,
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
                </div>
              </div>
            </div>
          </div>

          {/* Card Face Quick Actions */}
          <div className="flex items-center gap-2.5 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTimestampModal(true)}
              disabled={isUpdating || (isTv && loadingTv)}
              className="btn btn-ghost text-xs flex items-center gap-1"
              style={{
                padding: '0.4rem 0.85rem',
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
              disabled={isUpdating || (isTv && loadingTv) || allWatched}
              className="btn text-xs flex items-center gap-1 transition-transform"
              style={{
                padding: '0.4rem 0.85rem',
                background: allWatched
                  ? 'hsl(var(--color-surface-3))'
                  : (isUpdating || (isTv && loadingTv))
                    ? 'hsl(var(--color-surface-2))'
                    : 'hsl(var(--color-success) / 0.1)',
                color: allWatched
                  ? 'hsl(var(--color-text-muted))'
                  : (isUpdating || (isTv && loadingTv))
                    ? 'hsl(var(--color-text-subtle))'
                    : 'hsl(var(--color-success))',
                border: `1px solid ${
                  allWatched
                    ? 'hsl(var(--color-border))'
                    : (isUpdating || (isTv && loadingTv))
                      ? 'hsl(var(--color-border) / 0.5)'
                      : 'hsl(var(--color-success) / 0.2)'
                }`,
                borderRadius: '0.5rem',
                cursor: (isUpdating || (isTv && loadingTv) || allWatched) ? 'not-allowed' : 'pointer',
                opacity: (isUpdating || (isTv && loadingTv)) ? 0.7 : 1,
              }}
            >
              {isUpdating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              {isTv
                ? allWatched
                  ? 'All Caught Up 🎉'
                  : isUpdating
                    ? 'Updating...'
                    : 'Mark Episode Watched'
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
              tmdbId={media.tmdb_id}
              showData={showData}
              progress={progress}
              setProgress={setProgress}
            />
          </div>
        </div>
      )}

      {/* Render TimestampModal */}
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
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [episodeData, setEpisodeData] = useState<Record<number, TmdbEpisode[]>>({});
  const supabase = createClient();

  async function loadSeasonEpisodes(seasonNum: number) {
    if (episodeData[seasonNum]) return;
    setLoadingSeason(seasonNum);
    try {
      const res = await fetch(`/api/tmdb/media/tv/${tmdbId}?season=${seasonNum}`);
      const data: TmdbSeason = await res.json();
      setEpisodeData((prev) => ({ ...prev, [seasonNum]: data.episodes ?? [] }));
    } catch {
      // Ignore fetch errors to avoid UI crashes
    } finally {
      setLoadingSeason(null);
    }
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

  // Prefetch the active season (the highest season the user has watched, or season 1)
  useEffect(() => {
    const watchedEps = Object.values(progress).filter(p => p.watched);
    let activeSeason = 1;
    if (watchedEps.length > 0) {
      activeSeason = Math.max(...watchedEps.map(p => p.season_number));
    }
    // Check if the user is completely done with the active season, in which case prefetch the next one
    const activeSeasonEps = watchedEps.filter(p => p.season_number === activeSeason);
    const seasonData = showData.seasons.find(s => s.season_number === activeSeason);
    if (seasonData && seasonData.episode_count === activeSeasonEps.length) {
      const nextSeason = showData.seasons.find(s => s.season_number === activeSeason + 1);
      if (nextSeason) activeSeason = nextSeason.season_number;
    }
    
    // Fire and forget prefetch
    loadSeasonEpisodes(activeSeason).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const realSeasons = showData.seasons.filter((s) => s.season_number > 0);

  return (
    <div>
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
              onClick={() => {
                if (!isOpen) {
                  setOpenSeason(season.season_number);
                  loadSeasonEpisodes(season.season_number).catch(() => {});
                } else {
                  setOpenSeason(null);
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm transition-all hover:bg-white/[0.02]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--color-text))' }}
            >
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{season.name}</span>
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
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'hsl(var(--color-text-muted))' }}>
                  {watchedCount}/{season.episode_count} ep{season.episode_count !== 1 ? 's' : ''}
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            <div className={`collapsible-grid ${isOpen ? 'expanded' : ''}`}>
              <div className="collapsible-inner" style={{ padding: isOpen ? '0 1rem 1rem' : '0 1rem' }}>
                {loadingSeason === season.season_number ? (
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
                      onToggle={() => toggleEpisode(season.season_number, ep.episode_number)}
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
  const watched = progress?.watched ?? false;

  return (
    <div
      className="flex items-center gap-3 py-2 rounded-lg px-2 -mx-2 transition-all animate-slide-up"
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
          <p className="text-xs text-subtle inline-flex items-center gap-1.5">
            {new Date(episode.air_date).toLocaleDateString()}
            <StarRating rating={episode.vote_average} size="sm" />
          </p>
        )}
        {!episode.air_date && episode.vote_average > 0 && (
          <div className="mt-0.5">
            <StarRating rating={episode.vote_average} size="sm" />
          </div>
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
        {progress?.stopped_at_timestamp ?? 'Set timestamp'}
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
