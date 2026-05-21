'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isLight = document.documentElement.classList.contains('light');
    setTheme(isLight ? 'light' : 'dark');
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('couchlog-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('couchlog-theme', 'dark');
    }
  }

  // Render a placeholder with identical dimensions to prevent layout shift during mounting
  if (!mounted) {
    return (
      <div 
        className="w-9 h-9 rounded-xl flex-shrink-0" 
        style={{
          background: 'hsl(var(--color-surface-2))',
          border: '1px solid hsl(var(--color-border))',
        }}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group overflow-hidden flex-shrink-0"
      style={{
        background: 'hsl(var(--color-surface-2))',
        border: '1px solid hsl(var(--color-border))',
        color: 'hsl(var(--color-text))',
        cursor: 'pointer',
      }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* Inner background glow effect */}
      <span 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, hsl(var(--color-brand) / 0.12), transparent 70%)'
        }}
      />

      {/* Animated Sun Icon */}
      <Sun
        size={18}
        className={`absolute transition-all duration-500 ease-out transform ${
          theme === 'light'
            ? 'rotate-0 scale-100 opacity-100'
            : 'rotate-90 scale-50 opacity-0'
        }`}
        style={{ color: 'hsl(var(--color-brand))' }}
      />

      {/* Animated Moon Icon */}
      <Moon
        size={18}
        className={`absolute transition-all duration-500 ease-out transform ${
          theme === 'dark'
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-50 opacity-0'
        }`}
        style={{ color: 'hsl(var(--color-accent))' }}
      />
    </button>
  );
}
