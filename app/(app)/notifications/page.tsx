'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/lib/types';
import { posterUrl } from '@/lib/tmdb';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="mb-1">Notifications</h1>
          <p className="text-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-ghost text-sm">
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--color-border))' }} />
          <p className="text-muted text-lg">No notifications yet</p>
          <p className="text-subtle text-sm mt-1">
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
      className="flex items-start gap-3 p-4 rounded-xl transition-all"
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
