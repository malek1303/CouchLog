import { NextRequest, NextResponse } from 'next/server';
import { getTvDetails, getMovieDetails, getTvSeasonDetails } from '@/lib/tmdb';

interface RouteParams {
  params: Promise<{ type: string; id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { type, id } = await params;
  const tmdbId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');

  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: 'Invalid TMDB ID' }, { status: 400 });
  }

  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ error: 'Type must be movie or tv' }, { status: 400 });
  }

  try {
    let data;
    if (type === 'tv' && season !== null) {
      data = await getTvSeasonDetails(tmdbId, parseInt(season, 10));
    } else if (type === 'tv') {
      data = await getTvDetails(tmdbId);
    } else {
      data = await getMovieDetails(tmdbId);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[TMDB Media]', error);
    return NextResponse.json({ error: 'TMDB fetch failed' }, { status: 500 });
  }
}
