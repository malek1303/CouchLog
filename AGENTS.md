<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CouchLog — Agent & Contributor Guide

CouchLog is a movie and TV show watchlist & episode-progress tracker built on Next.js App Router, Supabase (Auth + PostgreSQL with RLS), TMDB API, and Tailwind CSS v4.

## 1. Tech Stack & Runtime Environment
- **Framework**: Next.js `16.2.6` (App Router), React `19.2.4`, TypeScript `5`.
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";` in `app/globals.css`) + HSL CSS custom properties (`--color-brand`, `--color-accent`, etc.).
- **Backend / Auth**: `@supabase/ssr` + `@supabase/supabase-js` with PostgreSQL Row Level Security (RLS).
- **External API**: TMDB v3 REST API (`lib/tmdb.ts`, server-side only using `TMDB_READ_ACCESS_TOKEN`).
- **Next.js 16 Conventions**:
  - Uses `proxy.ts` at the repo root (NOT `middleware.ts`) for request-level session refresh and route protection.
  - Route handler `params` and `cookies()` are `Promise`-based (`await params`, `await cookies()`).
  - Always check `node_modules/next/dist/docs/` if changing Next.js routing, caching, or config APIs.
- **Node PATH**: On this machine, `node`/`npm`/`npx` may live in NVM (`/home/malek/.nvm/versions/node/v24.15.0/bin`). Prepend it to `PATH` if `npm`/`npx` is not on the default shell `PATH`.

## 2. Directory Structure
```
app/
  (auth)/                 # Unauthenticated/auth pages: /login, /register, /forgot-password, /reset-password
  (app)/                  # Protected app pages wrapped in AppNav:
    home/page.tsx         # Discover & search movies/TV + trending feeds
    my-list/page.tsx      # "Watchlist" (status === 'to_watch')
    in-progress/page.tsx  # 4-category tracking board with drag-and-drop & episode checklists
    notifications/page.tsx# Released episode alerts + upcoming flagged episodes
    about/page.tsx        # About CouchLog & developer info
  auth/confirm/route.ts   # PKCE code exchange & OTP token_hash verification callback
  api/
    auth/check-email/     # Service-role duplicate-email check for registration
    cron/check-new-episodes/ # GET (Vercel Cron) & POST (session sync) episode notifier
    media/upsert/         # Service-role upsert into public.media
    tmdb/search/          # Authenticated proxy to TMDB search
    tmdb/trending/        # Authenticated proxy to TMDB trending
    tmdb/media/[type]/[id]/ # Authenticated proxy to TMDB show/movie/season details
components/
  auth/auth-form.tsx      # Shared Sign In / Create Account form
  nav/app-nav.tsx         # Desktop sidebar + mobile header & drawer
  nav/global-search.tsx   # Global search command-palette modal (⌘K or /)
  nav/theme-toggle.tsx    # Dark/light theme toggle
  notifications/notification-bell.tsx # Unread badge + background session sync
  progress/timestamp-modal.tsx # Portal modal for paused timestamp & episode selection
  ui/                     # StarRating, Toast, Toaster
hooks/use-toast.ts        # Custom toast store
lib/
  supabase/               # client.ts (browser), server.ts (server + service role), middleware.ts (updateSession)
  tmdb.ts                 # SSRF-guarded TMDB fetch helpers + getRecentAndUpcomingEpisodes
  types.ts                # Shared DB and TMDB TypeScript interfaces
supabase/schema.sql       # Full Postgres schema, indexes, RLS policies, and RPCs
proxy.ts                  # Next.js 16 proxy middleware
vercel.json               # Daily cron schedule calling /api/cron/check-new-episodes
```

## 3. Authentication & Route Protection (`proxy.ts` & `app/auth/confirm/route.ts`)
- `GUEST_ONLY_ROUTES` (`/login`, `/register`, `/forgot-password`) redirect already-signed-in users to `/home`.
- `/auth/confirm` is **never** blocked or redirected when a user already has a session, so `exchangeCodeForSession(code)` and `verifyOtp({ type, token_hash })` always run.
- `/reset-password` requires an authenticated (recovery) session and must **not** redirect signed-in users away—otherwise the recovery link lands on `/home` instead of the reset form.
- Legacy `/search` redirects to `/home`.
- Incoming `?code=` or `?token_hash=` query params hitting non-confirm routes are forwarded to `/auth/confirm`.

## 4. Database Schema & RLS Model (`supabase/schema.sql`)
- `public.media`: Shared TMDB cache. Readable by `authenticated`, writable only via `service_role` (`/api/media/upsert` and `/api/cron/check-new-episodes`).
- `public.watchlist`: User-scoped via `auth.uid() = user_id`. Unique `(user_id, media_id)`.
  - `to_watch` → displayed on `/my-list` (**Watchlist**).
  - The 4 categories on `/in-progress` map to `watchlist.status`:
    1. **Actively Watching** → `status = 'watching'`
    2. **Come Back Later** → `status = 'dropped'`
    3. **Want to Rewatch** → `status = 'rewatch'` (falls back gracefully to `status = 'completed'` with `last_timestamp = '__rewatch__'` if a remote database still enforces the older 4-value `CHECK` constraint)
    4. **Finished** → `status = 'completed'` (without `__rewatch__` marker)
- `public.episode_progress` & `public.movie_progress`: User-scoped granular watched flags and `stopped_at_timestamp`.
  - **Important**: `InProgressCard` synchronizes `watchlist.current_season`, `current_episode`, and `last_timestamp` from `episode_progress`. Any programmatic update to a TV show's current episode/timestamp MUST update `episode_progress` as well as `watchlist`.
- `public.notifications`: User-scoped read/update; inserted by `service_role` in `/api/cron/check-new-episodes`.

## 5. Episode Air Dates & Notifications
- **Unaired Episodes**: Use `isEpisodeAired(airDate)` (`Boolean(airDate && airDate <= localYYYYMMDD)`). Never allow users to mark unaired or TBA episodes as watched or set paused timestamps on them. Unaired episodes display an **Upcoming** release badge and a **Notify on release** flag badge.
- **Next Up / Paused Badge**: `InProgressCard` prefetches key seasons so the card header displays the episode name (`S{season}:E{episode} — "{name}"`) and excludes unaired episodes from `totalAiredEpisodes` and `allAiredWatched` completion checks.
- **Notifications Sync (`/api/cron/check-new-episodes`)**:
  - Exports both `GET` (for Vercel Cron using `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`) and `POST` (also usable by an authenticated user session to sync their own active TV watchlist).
  - `NotificationBell` triggers a throttled background sync via `sessionStorage`, and `/notifications` runs a sync on load and displays both delivered notifications and **Upcoming Episodes · Flagged for Notification**.

## 6. Client State Synchronization Events
Because `GlobalSearch` lives in `AppNav` outside page components, mutations dispatch browser `CustomEvent`s so all mounted views update immediately without a page reload:
- `couchlog:watchlist-updated`: Dispatched whenever a watchlist item is added, moved, or deleted (`GlobalSearch`, `HomePage`, `MyListPage`, `InProgressPage`). Listeners reload their watchlist state.
- `couchlog:notifications-updated`: Dispatched when notifications are marked read or synced (`NotificationsPage`, `NotificationBell`).

## 7. CSS & Tailwind v4 Rules (`app/globals.css`)
- **Do not** place `.btn`, `.card`, `.badge`, `.glass`, or `.divider` inside `@layer utilities`. In Tailwind v4, rules inside `@layer utilities` placed after `@import "tailwindcss"` override Tailwind padding/sizing/typography utility classes (`p-2`, `px-3`, `text-xs`, etc.). Keep custom component classes inside `@layer components`.
- Prefer `HSL` design tokens (`hsl(var(--color-...))`) so both dark mode (`:root`) and light mode (`html.light`) stay consistent.

## 8. Verification Commands
Before finishing any change, verify TypeScript, ESLint, and the production Next.js build:
```bash
rm -rf .next
npx tsc --noEmit
npm run lint
npm run build
```
