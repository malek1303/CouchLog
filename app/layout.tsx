import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CouchLog — Track What You Watch',
  description:
    'CouchLog lets you manage your movie and TV show watchlists, track exactly where you paused, and get notified when new episodes drop.',
  keywords: ['watchlist', 'tv tracker', 'movie tracker', 'episode progress'],
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storedTheme = localStorage.getItem('couchlog-theme');
                  const theme = storedTheme === 'light' ? 'light' : 'dark';
                  document.documentElement.classList.add(theme);
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
