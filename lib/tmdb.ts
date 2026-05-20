/**
 * TMDB API helpers — all calls are server-side only.
 * Uses the v4 Read Access Token (Bearer auth).
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: tmdbHeaders(),
    next: { revalidate: 3600 }, // cache for 1 hour
  });

  if (!res.ok) {
    throw new Error(`TMDB fetch failed: ${res.status} ${path}`);
  }

  return res.json() as Promise<T>;
}

/** Poster URL helper */
export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string {
  if (!path) return '/placeholder-poster.png';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/** Multi-search (movies + TV shows) */
export async function searchMedia(query: string, mediaType?: 'movie' | 'tv') {
  if (mediaType) {
    return tmdbFetch(`/search/${mediaType}?query=${encodeURIComponent(query)}&include_adult=false`);
  }
  return tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
}

/** Full TV show details with seasons list */
export async function getTvDetails(tmdbId: number) {
  return tmdbFetch(`/tv/${tmdbId}?append_to_response=external_ids`);
}

/** Season details including all episodes */
export async function getTvSeasonDetails(tmdbId: number, seasonNumber: number) {
  return tmdbFetch(`/tv/${tmdbId}/season/${seasonNumber}`);
}

/** Full movie details */
export async function getMovieDetails(tmdbId: number) {
  return tmdbFetch(`/movie/${tmdbId}`);
}

/** Episodes airing today for a given show — used by the cron route */
export async function getEpisodesAiringToday(tmdbId: number, numberOfSeasons: number) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
  const results: { season: number; episode: number; name: string }[] = [];

  // Check the last 3 seasons to keep API calls manageable
  const seasonsToCheck = Array.from(
    { length: Math.min(3, numberOfSeasons) },
    (_, i) => numberOfSeasons - i
  );

  await Promise.all(
    seasonsToCheck.map(async (seasonNum) => {
      try {
        const data = await tmdbFetch<{ episodes: { episode_number: number; name: string; air_date: string | null }[] }>(
          `/tv/${tmdbId}/season/${seasonNum}`
        );
        data.episodes?.forEach((ep) => {
          if (ep.air_date === today) {
            results.push({ season: seasonNum, episode: ep.episode_number, name: ep.name });
          }
        });
      } catch {
        // Skip seasons that fail to fetch
      }
    })
  );

  return results;
}
