// Minimal toast state manager — no external dependencies.
'use client';

import * as React from 'react';

export type ToastVariant = 'default' | 'destructive';

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastInput = Omit<ToastProps, 'id'>;

interface ToastStore {
  toasts: ToastProps[];
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const listeners: Array<(store: ToastStore) => void> = [];
let memoryState: ToastProps[] = [];
let idCounter = 0;

function dispatch(toasts: ToastProps[]) {
  memoryState = toasts;
  listeners.forEach((l) => l({ toasts, toast, dismiss }));
}

function toast(input: ToastInput) {
  const id = String(++idCounter);
  const duration = input.duration ?? 4000;

  dispatch([...memoryState, { ...input, id }]);

  setTimeout(() => {
    dispatch(memoryState.filter((t) => t.id !== id));
  }, duration);
}

function dismiss(id: string) {
  dispatch(memoryState.filter((t) => t.id !== id));
}

export function useToast(): ToastStore {
  const [state, setState] = React.useState<ToastProps[]>(memoryState);

  React.useEffect(() => {
    const listener = (store: ToastStore) => setState(store.toasts);
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { toasts: state, toast, dismiss };
}
