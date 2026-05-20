# 🛋️ CouchLog

CouchLog is a premium, comprehensive TV show and movie tracking platform. Built with an API-first architecture, CouchLog provides users with a beautifully optimized, fast, and visual dashboard to manage their personal watchlists, track exact viewing progress, and receive new episode notifications.

---

## 🎯 Overall Goal & Mobile-First Vision

CouchLog is designed from the ground up to be **API-first**. 
- **Decoupled Data Layer**: The PostgreSQL database (Supabase) and authentication logic are decoupled from Next.js server-side rendering.
- **Future-Proof**: All client actions are built using clean, client-safe endpoints and direct REST queries. This ensures that when a mobile client (React Native / iOS / Android) is built down the line, it can consume the exact same backend queries and Supabase structures seamlessly without modifying the database.

---

## ✨ Features & Capabilities

### 1. 🔍 Instant Search & Media Discovery
* Fully typed multi-search powered by **The Movie Database (TMDB) API**.
* Intuitively badges movies vs. TV shows.
* Inline "Add to List" mechanism with automatic local caching.

### 2. 📋 Watchlist Management ("My List")
* Complete tracking dashboard split by media status (`To Watch`, `Watching`, `Completed`, `Dropped`).
* **TV Show Accordion**: Lazy-loads seasons directly from TMDB on expand.
* **Interactive Header Toggle**: Click anywhere on a watch list item header to smoothly toggle the season accordion.
* **Gradient Season Progress Bars**: Sleek, animated HSL-tailored progress tracks displaying season completion percentages dynamically as you check off episodes.

### 3. ⏱️ Stopped-At Timestamp Tracking
* High-fidelity, frame-perfect timestamp logger for both movie progress and specific episodes.
* Time-validated modal supporting double-digit format checking (`HH:MM:SS` or `MM:SS`).
* Instant keyboard shortcut listener (`Enter` to save, `Escape` to close).

### 4. 🍿 "In Progress" Dashboard
* Dedicated hub presenting all currently paused TV episodes and movies.
* Includes direct "Update Timestamp" modals and "Mark Watched" operations.

### 5. 🔔 Automated Air Date Notifications
* Real-time notifications bell inside a sleek desktop navigation sidebar.
* Protected CRON schedule endpoint (`/api/cron/check-new-episodes`) that scans active watchlists daily, matching upcoming episode air dates against today's date to alert users.

---

## 🛠️ Technology Stack

* **Core Framework**: [Next.js (App Router)](https://nextjs.org) with React Server Components & TypeScript
* **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL) with Row Level Security (RLS) policies
* **Styles**: Vanilla CSS Design Tokens (HSL Variable System) & Tailwind CSS
* **Icons**: Lucide React
* **Hosting / CI/CD**: Ready for Vercel deployment

---

## 🗄️ Database Schema & Security

The database operates securely using Supabase Auth and strict Postgres Row Level Security (RLS). Below is the core architecture:

* **`media`**: Caches TMDB details (TMDB ID, title, poster path, media type) to minimize live API overhead.
* **`watchlist`**: Stores user-to-media associations and tracking status (`to_watch`, `watching`, `completed`, `dropped`).
* **`episode_progress`**: Granular tracking table caching `season_number`, `episode_number`, `watched` (boolean), and `stopped_at_timestamp` (string).
* **`movie_progress`**: Tracks `watched` boolean and `stopped_at_timestamp` for movie media.
* **`notifications`**: Holds real-time air date alerts triggered dynamically via backend schedulers.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js (v18+) and a Supabase account.

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TMDB_READ_ACCESS_TOKEN=your_tmdb_bearer_token
CRON_SECRET=your_custom_cron_protection_header_value
```

### 3. Database Initialization
Run the schema setup script found in `supabase/schema.sql` directly inside the **Supabase SQL Editor** to create all tables, indexes, and RLS policies.

### 4. Install & Run Dev Server
```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view CouchLog!
