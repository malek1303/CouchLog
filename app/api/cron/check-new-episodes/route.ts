import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getEpisodesAiringToday } from '@/lib/tmdb';

/**
 * POST /api/cron/check-new-episodes
 *
 * Called daily by Vercel Cron. Checks TMDB for episodes airing today
 * across all TV shows on any user's watchlist and creates notifications.
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  // Authenticate the cron request
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const stats = { processed: 0, notified: 0, errors: 0 };

  try {
    // 1. Get all unique TV shows across all watchlists
    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('watchlist')
      .select('user_id, media_id, media!inner(id, tmdb_id, title, media_type, number_of_seasons)')
      .eq('media.media_type', 'tv')
      .neq('status', 'completed')
      .neq('status', 'dropped');

    if (watchlistError) throw watchlistError;
    if (!watchlistItems || watchlistItems.length === 0) {
      return NextResponse.json({ ...stats, message: 'No TV watchlist entries found' });
    }

    // 2. Deduplicate by media_id to avoid redundant TMDB calls
    const mediaMap = new Map<string, { tmdb_id: number; title: string; number_of_seasons: number | null; users: string[] }>();
    for (const item of watchlistItems) {
      const media = item.media as unknown as { id: string; tmdb_id: number; title: string; number_of_seasons: number | null };
      if (!mediaMap.has(item.media_id)) {
        mediaMap.set(item.media_id, { tmdb_id: media.tmdb_id, title: media.title, number_of_seasons: media.number_of_seasons, users: [] });
      }
      mediaMap.get(item.media_id)!.users.push(item.user_id);
    }

    // 3. Check each show for episodes airing today
    for (const [mediaId, { tmdb_id, title, number_of_seasons, users }] of mediaMap) {
      stats.processed++;
      try {
        // Fallback to fetch if number_of_seasons is null (from before migration)
        let seasonsCount = number_of_seasons;
        if (seasonsCount === null) {
          const { getTvDetails: getDetails } = await import('@/lib/tmdb');
          const showData = await getDetails(tmdb_id) as { number_of_seasons: number };
          seasonsCount = showData.number_of_seasons;
        }

        const airingEpisodes = await getEpisodesAiringToday(tmdb_id, seasonsCount);

        if (airingEpisodes.length === 0) continue;

        // 4. For each airing episode, notify all subscribed users
        for (const ep of airingEpisodes) {
          for (const userId of users) {
            // Check for duplicate notification
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', userId)
              .eq('media_id', mediaId)
              .eq('metadata->season_number', ep.season)
              .eq('metadata->episode_number', ep.episode)
              .single();

            if (existing) continue;

            // Insert notification
            const { error: insertError } = await supabase.from('notifications').insert({
              user_id: userId,
              media_id: mediaId,
              type: 'new_episode',
              message: `New episode of ${title}: S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')} — "${ep.name}" is now available!`,
              metadata: {
                season_number: ep.season,
                episode_number: ep.episode,
                episode_name: ep.name,
                air_date: new Date().toISOString().split('T')[0],
              },
            });

            if (!insertError) stats.notified++;
          }
        }
      } catch (err) {
        console.error(`[Cron] Error processing show ${tmdb_id}:`, err);
        stats.errors++;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', ...stats }, { status: 500 });
  }
}
