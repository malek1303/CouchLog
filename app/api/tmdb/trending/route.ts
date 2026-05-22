import { NextRequest, NextResponse } from 'next/server';
import { getTrendingMedia } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'movie' | 'tv' | null;

  if (!type || (type !== 'movie' && type !== 'tv')) {
    return NextResponse.json({ error: 'Type must be "movie" or "tv"' }, { status: 400 });
  }

  try {
    const data = await getTrendingMedia(type);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[TMDB Trending API Error]', error);
    return NextResponse.json({ error: 'Failed to fetch trending media' }, { status: 500 });
  }
}
