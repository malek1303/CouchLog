import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchMedia } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  // Enforce session check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
