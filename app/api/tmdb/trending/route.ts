import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrendingMedia } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Enforce session check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
