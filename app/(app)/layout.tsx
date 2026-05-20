import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppNav from '@/components/nav/app-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--color-bg))' }}>
      <AppNav userEmail={user.email ?? ''} />

      {/* Content area — offset by sidebar on desktop */}
      <main
        className="lg:ml-60 pt-16 lg:pt-0"
        style={{ minHeight: '100vh' }}
      >
        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
