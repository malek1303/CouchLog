import { NextRequest, NextResponse } from 'next/server';
import { searchMedia } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') as 'movie' | 'tv' | null;

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [], total_results: 0 });
  }

  try {
    const data = await searchMedia(query.trim(), type || undefined);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[TMDB Search]', error);
    return NextResponse.json({ error: 'TMDB search failed' }, { status: 500 });
  }
}
