'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Home, Search, List, PlayCircle, Bell, Tv, LogOut, Menu, X, Info
} from 'lucide-react';
import NotificationBell from '@/components/notifications/notification-bell';
import ThemeToggle from '@/components/nav/theme-toggle';
import GlobalSearch from '@/components/nav/global-search';

const NAV_ITEMS = [
  { href: '/home',          label: 'Home',        icon: Home },
  { href: '/my-list',       label: 'Watchlist',   icon: List },
  { href: '/in-progress',   label: 'In Progress', icon: PlayCircle },
  { href: '/about',         label: 'About Us',    icon: Info },
];

interface AppNavProps {
  userEmail: string;
}

export default function AppNav({ userEmail }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = userEmail?.slice(0, 2).toUpperCase() ?? 'CL';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-60 z-40 glass"
        style={{ borderRight: '1px solid hsl(var(--color-border))', padding: '1.5rem 1rem' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between mb-8 px-2">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2.5 group">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
              style={{ background: 'hsl(var(--color-brand) / 0.15)', border: '1px solid hsl(var(--color-brand) / 0.3)' }}
            >
              <Tv size={18} style={{ color: 'hsl(var(--color-brand))' }} />
            </div>
            <span className="text-lg font-bold" style={{ letterSpacing: '-0.02em' }}>CouchLog</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Search trigger button (SaaS command-palette style) */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-between w-full px-3 py-2.5 mb-4 rounded-xl text-sm font-medium transition-all hover:bg-surface-2 hover:border-brand/40"
          style={{
            background: 'hsl(var(--color-surface-2))',
            color: 'hsl(var(--color-text-muted))',
            border: '1px solid hsl(var(--color-border))',
            cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Search size={15} />
            <span>Search...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-3 border text-[10px] font-bold" style={{ borderColor: 'hsl(var(--color-border))', background: 'hsl(var(--color-surface-3))' }}>
            ⌘K
          </kbd>
        </button>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'hsl(var(--color-brand) / 0.15)' : 'transparent',
                  color: active ? 'hsl(var(--color-brand))' : 'hsl(var(--color-text-muted))',
                  border: active ? '1px solid hsl(var(--color-brand) / 0.25)' : '1px solid transparent',
                }}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}

          {/* Notifications */}
          <Link
            href="/notifications"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: pathname.startsWith('/notifications') ? 'hsl(var(--color-brand) / 0.15)' : 'transparent',
              color: pathname.startsWith('/notifications') ? 'hsl(var(--color-brand))' : 'hsl(var(--color-text-muted))',
              border: pathname.startsWith('/notifications') ? '1px solid hsl(var(--color-brand) / 0.25)' : '1px solid transparent',
            }}
          >
            <Bell size={17} />
            Notifications
            <NotificationBell compact />
          </Link>
        </nav>

        {/* User footer */}
        <div
          className="mt-auto pt-4"
          style={{ borderTop: '1px solid hsl(var(--color-border))' }}
        >
          <div className="flex items-center gap-3 px-2 mb-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold flex-shrink-0"
              style={{ background: 'hsl(var(--color-brand) / 0.2)', color: 'hsl(var(--color-brand))' }}
            >
              {initials}
            </div>
            <span className="text-sm truncate" style={{ color: 'hsl(var(--color-text-muted))' }}>
              {userEmail}
            </span>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost w-full text-sm" id="sign-out-btn">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 glass flex items-center justify-between px-4"
        style={{ height: '60px', borderBottom: '1px solid hsl(var(--color-border))' }}
      >
        <Link href="/home" className="flex items-center gap-2">
          <Tv size={20} style={{ color: 'hsl(var(--color-brand))' }} />
          <span className="font-bold">CouchLog</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setSearchOpen(true)}
            className="btn btn-ghost p-2 flex items-center justify-center"
            aria-label="Search"
            style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            <Search size={20} style={{ color: 'hsl(var(--color-text-muted))' }} />
          </button>
          <Link href="/notifications" aria-label="Notifications" className="flex items-center justify-center">
            <NotificationBell compact />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="btn btn-ghost p-2"
            aria-label="Toggle menu"
            id="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-72 glass flex flex-col p-6"
            style={{ borderLeft: '1px solid hsl(var(--color-border))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="self-end mb-6 btn btn-ghost p-2"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>

            {/* Mobile Drawer Search Trigger */}
            <button
              onClick={() => { setMobileOpen(false); setSearchOpen(true); }}
              className="flex items-center gap-3 px-3 py-3 mb-4 rounded-xl text-sm font-medium transition-all w-full text-left"
              style={{
                background: 'hsl(var(--color-surface-2))',
                color: 'hsl(var(--color-text-muted))',
                border: '1px solid hsl(var(--color-border))',
                cursor: 'pointer',
              }}
            >
              <Search size={17} />
              <span>Search...</span>
            </button>

            <nav className="space-y-1 flex-1">
              {[...NAV_ITEMS, { href: '/notifications', label: 'Notifications', icon: Bell }].map(
                ({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: active ? 'hsl(var(--color-brand) / 0.15)' : 'transparent',
                        color: active ? 'hsl(var(--color-brand))' : 'hsl(var(--color-text-muted))',
                      }}
                    >
                      <Icon size={17} />
                      {label}
                    </Link>
                  );
                }
              )}
            </nav>
            <button onClick={handleSignOut} className="btn btn-ghost w-full text-sm mt-4" id="mobile-sign-out-btn">
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Global Search command palette */}
      <GlobalSearch 
        isOpen={searchOpen} 
        onOpen={() => setSearchOpen(true)} 
        onClose={() => setSearchOpen(false)} 
      />
    </>
  );
}
