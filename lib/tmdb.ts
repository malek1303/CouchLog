/**
 * TMDB API helpers — all calls are server-side only.
 * Uses the v4 Read Access Token (Bearer auth).
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_ORIGIN = 'https://api.themoviedb.org';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Validates that a constructed URL still targets the TMDB API.
 * Prevents SSRF via path traversal, host injection, or protocol manipulation.
 */
function assertTmdbUrl(url: URL): void {
  if (url.origin !== TMDB_ORIGIN) {
    throw new Error(`SSRF blocked: URL origin "${url.origin}" does not match TMDB API`);
  }
  if (!url.pathname.startsWith('/3/')) {
    throw new Error(`SSRF blocked: URL path "${url.pathname}" escapes the /3/ API prefix`);
  }
}

async function tmdbFetch<T>(path: string, revalidate: number = 3600): Promise<T> {
  // Build URL via the URL constructor to resolve any path traversal sequences
  const url = new URL(`${TMDB_BASE}${path}`);

  // Validate the resolved URL still points to TMDB
  assertTmdbUrl(url);

  const res = await fetch(url.toString(), {
    headers: tmdbHeaders(),
    next: { revalidate }, // cache control
  });

  if (!res.ok) {
    throw new Error(`TMDB fetch failed: ${res.status} ${path}`);
  }

  return res.json() as Promise<T>;
}

/** Poster URL helper */
export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string {
  if (!path) return '/placeholder-poster.png';
  // Reject paths containing traversal sequences
  if (path.includes('..')) return '/placeholder-poster.png';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/** Allowed media types for search — used as an allowlist */
const ALLOWED_SEARCH_TYPES = new Set(['movie', 'tv']);

/** Multi-search (movies + TV shows) */
export async function searchMedia(query: string, mediaType?: 'movie' | 'tv') {
  if (mediaType) {
    // Validate mediaType against the allowlist
    if (!ALLOWED_SEARCH_TYPES.has(mediaType)) {
      throw new Error(`Invalid media type: ${mediaType}`);
    }
    return tmdbFetch(`/search/${mediaType}?query=${encodeURIComponent(query)}&include_adult=false`);
  }
  return tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
}

/** Full TV show details with seasons list */
export async function getTvDetails(tmdbId: number) {
  const id = Math.floor(tmdbId);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid TMDB ID: ${tmdbId}`);
  return tmdbFetch(`/tv/${id}?append_to_response=external_ids`);
}

/** Season details including all episodes */
export async function getTvSeasonDetails(tmdbId: number, seasonNumber: number) {
  const id = Math.floor(tmdbId);
  const season = Math.floor(seasonNumber);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid TMDB ID: ${tmdbId}`);
  if (!Number.isFinite(season) || season < 0) throw new Error(`Invalid season number: ${seasonNumber}`);
  return tmdbFetch(`/tv/${id}/season/${season}`);
}

/** Full movie details */
export async function getMovieDetails(tmdbId: number) {
  const id = Math.floor(tmdbId);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid TMDB ID: ${tmdbId}`);
  return tmdbFetch(`/movie/${id}`);
}

export interface EpisodeAirInfo {
  season: number;
  episode: number;
  name: string;
  air_date: string | null;
}

/**
 * Finds recently aired episodes (last 7 days up to today) and upcoming/unaired episodes
 * across the latest 3 seasons of a TV show.
 */
export async function getRecentAndUpcomingEpisodes(
  tmdbId: number,
  numberOfSeasons?: number | null
): Promise<{
  recentlyAired: EpisodeAirInfo[];
  upcoming: EpisodeAirInfo[];
  numberOfSeasons: number;
  status?: string;
}> {
  const id = Math.floor(tmdbId);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid TMDB ID: ${tmdbId}`);

  let seasonsTotal = numberOfSeasons ?? 0;
  let showStatus: string | undefined;

  if (!seasonsTotal || seasonsTotal <= 0) {
    const showData = (await getTvDetails(id)) as { number_of_seasons?: number; status?: string };
    seasonsTotal = showData.number_of_seasons ?? 0;
    showStatus = showData.status;
  }

  if (seasonsTotal <= 0) {
    return { recentlyAired: [], upcoming: [], numberOfSeasons: seasonsTotal, status: showStatus };
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD UTC
  const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

  const recentlyAired: EpisodeAirInfo[] = [];
  const upcoming: EpisodeAirInfo[] = [];

  // Check the last 3 seasons to keep API calls manageable
  const seasonsToCheck = Array.from(
    { length: Math.min(3, seasonsTotal) },
    (_, i) => seasonsTotal - i
  ).filter((s) => s > 0);

  await Promise.all(
    seasonsToCheck.map(async (seasonNum) => {
      try {
        const data = await tmdbFetch<{
          episodes: { episode_number: number; name: string; air_date: string | null }[];
        }>(`/tv/${id}/season/${seasonNum}`, 1800);

        data.episodes?.forEach((ep) => {
          if (ep.air_date && ep.air_date <= today && ep.air_date >= sevenDaysAgo) {
            recentlyAired.push({
              season: seasonNum,
              episode: ep.episode_number,
              name: ep.name,
              air_date: ep.air_date,
            });
          } else if (!ep.air_date || ep.air_date > today) {
            upcoming.push({
              season: seasonNum,
              episode: ep.episode_number,
              name: ep.name,
              air_date: ep.air_date,
            });
          }
        });
      } catch {
        // Skip seasons that fail to fetch
      }
    })
  );

  // Sort upcoming chronologically by season, then episode
  upcoming.sort((a, b) => (a.season !== b.season ? a.season - b.season : a.episode - b.episode));
  recentlyAired.sort((a, b) => (a.season !== b.season ? a.season - b.season : a.episode - b.episode));

  return { recentlyAired, upcoming, numberOfSeasons: seasonsTotal, status: showStatus };
}

/** Episodes airing today for a given show — preserved helper */
export async function getEpisodesAiringToday(tmdbId: number, numberOfSeasons: number) {
  const { recentlyAired } = await getRecentAndUpcomingEpisodes(tmdbId, numberOfSeasons);
  const today = new Date().toISOString().split('T')[0];
  return recentlyAired
    .filter((ep) => ep.air_date === today)
    .map(({ season, episode, name }) => ({ season, episode, name }));
}

/** Allowed trending types and time windows — used as allowlists */
const ALLOWED_TRENDING_TYPES = new Set(['movie', 'tv']);
const ALLOWED_TIME_WINDOWS = new Set(['day', 'week']);

/** Get trending media with a custom 3-day revalidate time (259200 seconds) */
export async function getTrendingMedia(mediaType: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week') {
  if (!ALLOWED_TRENDING_TYPES.has(mediaType)) {
    throw new Error(`Invalid media type: ${mediaType}`);
  }
  if (!ALLOWED_TIME_WINDOWS.has(timeWindow)) {
    throw new Error(`Invalid time window: ${timeWindow}`);
  }
  return tmdbFetch(`/trending/${mediaType}/${timeWindow}`, 259200);
}

