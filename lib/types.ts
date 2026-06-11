// Shared TypeScript interfaces for CouchLog
// These mirror the Supabase database schema exactly.

// ── Database Row Types ───────────────────────────────────────

export type MediaType = 'movie' | 'tv';
export type WatchlistStatus = 'to_watch' | 'watching' | 'completed' | 'dropped';

export interface Media {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  overview: string | null;
  status: string | null;
  vote_average: number;
  number_of_seasons: number | null;
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  media_id: string;
  status: WatchlistStatus;
  current_season: number;
  current_episode: number;
  last_timestamp: string | null;
  created_at: string;
  // Joined
  media?: Media;
}

export interface EpisodeProgress {
  id: string;
  user_id: string;
  media_id: string;
  season_number: number;
  episode_number: number;
  watched: boolean;
  stopped_at_timestamp: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  media?: Media;
}

export interface MovieProgress {
  id: string;
  user_id: string;
  media_id: string;
  watched: boolean;
  stopped_at_timestamp: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  media?: Media;
}

export interface Notification {
  id: string;
  user_id: string;
  media_id: string;
  type: string;
  message: string;
  read: boolean;
  metadata: NotificationMetadata | null;
  created_at: string;
  // Joined
  media?: Media;
}

export interface NotificationMetadata {
  season_number?: number;
  episode_number?: number;
  episode_name?: string;
  air_date?: string;
}

// ── TMDB API Response Types ──────────────────────────────────

export interface TmdbSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;          // movies
  name?: string;           // tv shows
  poster_path: string | null;
  overview: string;
  release_date?: string;   // movies
  first_air_date?: string; // tv
  vote_average: number;
  status?: string;
}

export interface TmdbSearchResponse {
  results: TmdbSearchResult[];
  total_results: number;
  total_pages: number;
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
}

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  episodes?: TmdbEpisode[];
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  status: string;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeason[];
  vote_average: number;
  genres: { id: number; name: string }[];
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  status: string;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: { id: number; name: string }[];
}

// ── UI / Utility Types ───────────────────────────────────────

export interface InProgressItem {
  type: 'episode' | 'movie';
  media: Media;
  stopped_at_timestamp: string;
  // Episode-specific
  season_number?: number;
  episode_number?: number;
  episode_name?: string;
  // Shared
  progress_id: string;
  updated_at: string;
}
