'use client';

import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  /** 'sm' for compact inline use (episode rows), 'md' for cards */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Displays a TMDB rating as a yellow star + score badge.
 * Ratings of 0 (unrated) are hidden.
 */
export default function StarRating({ rating, size = 'md', className = '' }: StarRatingProps) {
  if (!rating || rating === 0) return null;

  const display = rating.toFixed(1);
  const iconSize = size === 'sm' ? 11 : 13;
  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '0.15rem 0.35rem' : '0.2rem 0.45rem';
  const gap = size === 'sm' ? '2px' : '3px';

  return (
    <span
      className={`inline-flex items-center font-bold ${className}`}
      style={{
        gap,
        padding,
        borderRadius: '0.375rem',
        fontSize,
        lineHeight: 1,
        background: 'hsl(45 100% 51% / 0.12)',
        color: 'hsl(45 100% 44%)',
        border: '1px solid hsl(45 100% 51% / 0.2)',
        whiteSpace: 'nowrap',
      }}
      title={`${display} / 10`}
    >
      <Star
        size={iconSize}
        fill="hsl(45 100% 51%)"
        stroke="hsl(45 100% 51%)"
        style={{ flexShrink: 0 }}
      />
      {display}
    </span>
  );
}
