import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getTvDetails } from '@/lib/tmdb';

/**
 * POST /api/media/upsert
 * Inserts or updates a media row (uses service role to bypass RLS on media table).
 * Returns the media UUID for use in watchlist insert.
 */
export async function POST(request: NextRequest) {
  // Enforce session check
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tmdb_id, media_type, title, poster_path, overview, vote_average } = body;
  let { status, number_of_seasons } = body;

  if (!tmdb_id || !media_type || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Populate TV show number_of_seasons and status on initial insert if omitted (e.g. from search/trending)
  if (media_type === 'tv' && (number_of_seasons == null || status == null)) {
    try {
      const tvDetails = (await getTvDetails(Number(tmdb_id))) as {
        number_of_seasons?: number;
        status?: string;
      };
      number_of_seasons = number_of_seasons ?? tvDetails.number_of_seasons ?? null;
      status = status ?? tvDetails.status ?? null;
    } catch {
      // Proceed even if TMDB details enrichment fails
    }
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('media')
    .upsert(
      {
        tmdb_id,
        media_type,
        title,
        poster_path,
        overview,
        status: status ?? null,
        vote_average: vote_average ?? 0,
        number_of_seasons: number_of_seasons ?? null,
      },
      { onConflict: 'tmdb_id,media_type', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (error) {
    console.error('[Media Upsert]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media_id: data.id });
}
