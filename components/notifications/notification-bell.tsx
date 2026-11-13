'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NotificationBellProps {
  compact?: boolean;
}

export default function NotificationBell({ compact }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (mounted) setUnreadCount(count ?? 0);
    }

    async function syncAndFetch() {
      // Trigger a lightweight per-session episode notification check so local/dev and active users stay synced
      try {
        const lastSync = sessionStorage.getItem('couchlog-notif-sync');
        const now = Date.now();
        if (!lastSync || now - Number(lastSync) > 5 * 60 * 1000) {
          sessionStorage.setItem('couchlog-notif-sync', String(now));
          await fetch('/api/cron/check-new-episodes', { method: 'POST' });
        }
      } catch {
        // Ignore sessionStorage or background sync errors
      }
      await fetchUnread();
    }

    syncAndFetch();

    const handleNotificationsUpdated = () => { fetchUnread(); };
    const handleWatchlistUpdated = async () => {
      try {
        sessionStorage.removeItem('couchlog-notif-sync');
      } catch {
        // Ignore
      }
      await syncAndFetch();
    };

    window.addEventListener('couchlog:notifications-updated', handleNotificationsUpdated);
    window.addEventListener('couchlog:watchlist-updated', handleWatchlistUpdated);

    // Poll every 30 seconds — avoids realtime channel lifecycle issues
    const interval = setInterval(fetchUnread, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('couchlog:notifications-updated', handleNotificationsUpdated);
      window.removeEventListener('couchlog:watchlist-updated', handleWatchlistUpdated);
    };
  }, []);

  if (compact) {
    return unreadCount > 0 ? (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ml-auto"
        style={{ background: 'hsl(var(--color-accent))', color: '#fff', fontSize: '0.65rem' }}
        aria-label={`${unreadCount} unread notifications`}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    ) : null;
  }

  return (
    <div className="relative inline-flex">
      <Bell size={20} style={{ color: 'hsl(var(--color-text-muted))' }} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
          style={{ background: 'hsl(var(--color-accent))', color: '#fff', fontSize: '0.6rem' }}
          aria-label={`${unreadCount} unread notifications`}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
}
