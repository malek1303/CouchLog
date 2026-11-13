import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getRecentAndUpcomingEpisodes } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export interface UpcomingEpisodeFlag {
  media_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string | null;
}

/**
 * Shared handler for GET (Vercel Cron) and POST (manual / client session sync).
 *
 * Authentication modes:
 * 1. Cron secret via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`
 *    -> scans active TV watchlists across all users.
 * 2. Authenticated user session
 *    -> scans only the signed-in user's active TV watchlist and returns upcoming flagged episodes.
 */
async function handleCheckNewEpisodes(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const legacyHeader = request.headers.get('x-cron-secret');
  const isCronAuthorized = Boolean(
    cronSecret && (authHeader === `Bearer ${cronSecret}` || legacyHeader === cronSecret)
  );

  let scopedUserId: string | null = null;
  if (!isCronAuthorized) {
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    scopedUserId = user.id;
  }

  const supabase = createServiceClient();
  const stats = { processed: 0, notified: 0, errors: 0 };
  const upcomingFlags: UpcomingEpisodeFlag[] = [];

  try {
    // 1. Get TV shows on active watchlists (watching, to_watch, dropped/come back later, rewatch)
    let query = supabase
      .from('watchlist')
      .select('user_id, media_id, media!inner(id, tmdb_id, title, poster_path, media_type, number_of_seasons, status)')
      .eq('media.media_type', 'tv')
      .neq('status', 'completed')
      .neq('status', 'dropped');

    if (scopedUserId) {
      query = query.eq('user_id', scopedUserId);
    }

    const { data: watchlistItems, error: watchlistError } = await query;

    if (watchlistError) throw watchlistError;
    if (!watchlistItems || watchlistItems.length === 0) {
      return NextResponse.json({ ...stats, upcoming: upcomingFlags, message: 'No TV watchlist entries found' });
    }

    // 2. Deduplicate by media_id to avoid redundant TMDB calls
    const mediaMap = new Map<
      string,
      {
        tmdb_id: number;
        title: string;
        poster_path: string | null;
        number_of_seasons: number | null;
        users: string[];
      }
    >();

    for (const item of watchlistItems) {
      const media = item.media as unknown as {
        id: string;
        tmdb_id: number;
        title: string;
        poster_path: string | null;
        number_of_seasons: number | null;
      };
      if (!mediaMap.has(item.media_id)) {
        mediaMap.set(item.media_id, {
          tmdb_id: media.tmdb_id,
          title: media.title,
          poster_path: media.poster_path,
          number_of_seasons: media.number_of_seasons,
          users: [],
        });
      }
      mediaMap.get(item.media_id)!.users.push(item.user_id);
    }

    // 3. Check each show for recently aired and upcoming episodes
    for (const [mediaId, info] of mediaMap) {
      stats.processed++;
      try {
        const { recentlyAired, upcoming, numberOfSeasons, status } = await getRecentAndUpcomingEpisodes(
          info.tmdb_id,
          info.number_of_seasons
        );

        // Persist number_of_seasons / status back to media table if it was missing
        if (info.number_of_seasons === null && numberOfSeasons > 0) {
          await supabase
            .from('media')
            .update({
              number_of_seasons: numberOfSeasons,
              ...(status ? { status } : {}),
            })
            .eq('id', mediaId);
        }

        if (scopedUserId && upcoming.length > 0) {
          // Include the next upcoming episode(s) for this show
          for (const ep of upcoming.slice(0, 5)) {
            upcomingFlags.push({
              media_id: mediaId,
              tmdb_id: info.tmdb_id,
              title: info.title,
              poster_path: info.poster_path,
              season_number: ep.season,
              episode_number: ep.episode,
              episode_name: ep.name,
              air_date: ep.air_date,
            });
          }
        }

        if (recentlyAired.length === 0) continue;

        // 4. Notify subscribed users for each recently aired episode they haven't watched or been notified for
        for (const ep of recentlyAired) {
          for (const userId of info.users) {
            // Skip if user already watched this episode
            const { data: watchedRow } = await supabase
              .from('episode_progress')
              .select('watched')
              .eq('user_id', userId)
              .eq('media_id', mediaId)
              .eq('season_number', ep.season)
              .eq('episode_number', ep.episode)
              .maybeSingle();

            if (watchedRow?.watched) continue;

            // Check for duplicate notification using text extraction (->>) + maybeSingle()
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', userId)
              .eq('media_id', mediaId)
              .eq('metadata->>season_number', String(ep.season))
              .eq('metadata->>episode_number', String(ep.episode))
              .maybeSingle();

            if (existing) continue;

            const { error: insertError } = await supabase.from('notifications').insert({
              user_id: userId,
              media_id: mediaId,
              type: 'new_episode',
              message: `New episode of ${info.title}: S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')} — "${ep.name}" is now available!`,
              metadata: {
                season_number: ep.season,
                episode_number: ep.episode,
                episode_name: ep.name,
                air_date: ep.air_date ?? new Date().toISOString().split('T')[0],
              },
            });

            if (!insertError) stats.notified++;
          }
        }
      } catch (err) {
        console.error(`[Cron] Error processing show ${info.tmdb_id}:`, err);
        stats.errors++;
      }
    }

    // Sort upcoming flags chronologically (dated items first, then TBA)
    upcomingFlags.sort((a, b) => {
      if (a.air_date && b.air_date) return a.air_date.localeCompare(b.air_date);
      if (a.air_date) return -1;
      if (b.air_date) return 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ ...stats, upcoming: upcomingFlags });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', ...stats }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCheckNewEpisodes(request);
}

export async function POST(request: NextRequest) {
  return handleCheckNewEpisodes(request);
}
