'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';

const ToastProvider = ToastPrimitives.Provider;
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={className}
    style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      maxWidth: '360px',
      width: '100%',
    }}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & { variant?: 'default' | 'destructive' }
>(({ variant = 'default', style, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '1rem 1.125rem',
      borderRadius: '0.875rem',
      background: variant === 'destructive'
        ? 'hsl(var(--color-error) / 0.12)'
        : 'hsl(var(--color-surface-2))',
      border: `1px solid ${variant === 'destructive' ? 'hsl(var(--color-error) / 0.3)' : 'hsl(var(--color-border))'}`,
      boxShadow: '0 8px 32px hsl(224 15% 4% / 0.5)',
      backdropFilter: 'blur(16px)',
      animation: 'slideUp 0.3s ease-out',
      ...style,
    }}
    {...props}
  />
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ style, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--color-text))', ...style }}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ style, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    style={{ fontSize: '0.8125rem', color: 'hsl(var(--color-text-muted))', marginTop: '0.125rem', ...style }}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>((props, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    style={{
      marginLeft: 'auto',
      flexShrink: 0,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'hsl(var(--color-text-subtle))',
      display: 'flex',
      padding: 2,
      borderRadius: 4,
    }}
    {...props}
  >
    <X size={14} />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose };
