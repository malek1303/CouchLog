'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Bell, Check, CheckCheck, Loader2, CalendarClock, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';

interface UpcomingFlag {
  media_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string | null;
}

function formatReleaseDate(dateStr: string | null): string {
  if (!dateStr) return 'TBA';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingFlags, setUpcomingFlags] = useState<UpcomingFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const supabase = createClient();

  const fetchNotificationsAndSync = useCallback(async (runEpisodeSync: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { list: [] as Notification[], upcoming: [] as UpcomingFlag[] };

    let upcoming: UpcomingFlag[] = [];
    if (runEpisodeSync) {
      try {
        const res = await fetch('/api/cron/check-new-episodes', { method: 'POST' });
        if (res.ok) {
          const json = (await res.json()) as { upcoming?: UpcomingFlag[] };
          upcoming = json.upcoming ?? [];
        }
      } catch {
        // Ignore network errors during background episode check
      }
    }

    const { data } = await supabase
      .from('notifications')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return {
      list: (data as Notification[]) ?? [],
      upcoming,
    };
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { list, upcoming } = await fetchNotificationsAndSync(true);
      if (!mounted) return;
      setNotifications(list);
      setUpcomingFlags(upcoming);
      setLoading(false);
      window.dispatchEvent(new CustomEvent('couchlog:notifications-updated'));
    }
    init();
    return () => { mounted = false; };
  }, [fetchNotificationsAndSync]);

  async function handleRefreshSync() {
    setSyncing(true);
    const { list, upcoming } = await fetchNotificationsAndSync(true);
    setNotifications(list);
    setUpcomingFlags(upcoming);
    setSyncing(false);
    window.dispatchEvent(new CustomEvent('couchlog:notifications-updated'));
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    window.dispatchEvent(new CustomEvent('couchlog:notifications-updated'));
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new CustomEvent('couchlog:notifications-updated'));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--color-brand))' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="mb-1">Notifications</h1>
            <p className="text-muted">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshSync}
              disabled={syncing}
              className="btn btn-ghost text-xs sm:text-sm"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              Check Releases
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="btn btn-ghost text-xs sm:text-sm">
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-14 rounded-2xl" style={{ border: '1px dashed hsl(var(--color-border))' }}>
            <Bell size={44} className="mx-auto mb-3" style={{ color: 'hsl(var(--color-border))' }} />
            <p className="text-muted text-lg">No notifications yet</p>
            <p className="text-subtle text-sm mt-1 px-4">
              Add TV shows to your list and we&apos;ll notify you when new episodes drop.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onMarkRead={() => markRead(notif.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Flagged Episodes (Issue #8) */}
      {upcomingFlags.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock size={18} style={{ color: 'hsl(var(--color-warning))' }} />
            <h2 className="text-lg font-bold">Upcoming Episodes · Flagged for Notification</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted mb-4">
            These episodes haven&apos;t aired yet and are flagged to notify you on release day.
          </p>
          <div className="space-y-2">
            {upcomingFlags.map((flag) => (
              <div
                key={`${flag.media_id}-${flag.season_number}-${flag.episode_number}`}
                className="flex items-center gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'hsl(var(--color-surface))',
                  border: '1px solid hsl(var(--color-border))',
                }}
              >
                {flag.poster_path && (
                  <div className="relative flex-shrink-0" style={{ width: 40, height: 60, borderRadius: '0.375rem', overflow: 'hidden' }}>
                    <Image
                      src={posterUrl(flag.poster_path, 'w185')}
                      alt={flag.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--color-text))' }}>
                    {flag.title}
                  </p>
                  <p className="text-xs text-muted truncate">
                    S{String(flag.season_number).padStart(2, '0')}E{String(flag.episode_number).padStart(2, '0')}
                    {flag.episode_name ? ` — "${flag.episode_name}"` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'hsl(var(--color-warning) / 0.14)',
                        color: 'hsl(var(--color-warning))',
                        border: '1px solid hsl(var(--color-warning) / 0.25)',
                      }}
                    >
                      <CalendarClock size={10} />
                      Airs {formatReleaseDate(flag.air_date)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'hsl(var(--color-info) / 0.12)',
                        color: 'hsl(var(--color-info))',
                        border: '1px solid hsl(var(--color-info) / 0.25)',
                      }}
                    >
                      <Bell size={10} />
                      Flagged
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── NotificationItem ───────────────────────────────────────────
function NotificationItem({
  notification: notif,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  const media = notif.media;
  const timeAgo = formatTimeAgo(notif.created_at);

  return (
    <div
      className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl transition-all"
      style={{
        background: notif.read ? 'hsl(var(--color-surface))' : 'hsl(var(--color-brand) / 0.07)',
        border: `1px solid ${notif.read ? 'hsl(var(--color-border))' : 'hsl(var(--color-brand) / 0.2)'}`,
      }}
    >
      {/* Poster thumbnail */}
      {media?.poster_path && (
        <div className="relative flex-shrink-0" style={{ width: 44, height: 66, borderRadius: '0.375rem', overflow: 'hidden' }}>
          <Image
            src={posterUrl(media.poster_path, 'w185')}
            alt={media.title}
            fill
            sizes="44px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: 'hsl(var(--color-text))' }}>
          {notif.message}
        </p>
        <p className="text-xs text-subtle mt-1">{timeAgo}</p>
      </div>

      {/* Unread dot + read button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!notif.read && (
          <>
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'hsl(var(--color-brand))',
                flexShrink: 0,
              }}
              aria-label="Unread"
            />
            <button
              onClick={onMarkRead}
              className="btn btn-ghost p-1.5"
              style={{ borderRadius: '0.375rem', minWidth: 0 }}
              aria-label="Mark as read"
              title="Mark as read"
            >
              <Check size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
