import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/home');
  } else {
    redirect('/login');
  }
}
