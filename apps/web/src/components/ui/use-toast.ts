import { useEffect, useState } from 'react';

/**
 * Toast store don gian (pub/sub o module-level), du dung cho Phase 4.
 * Radix Toast lo viec auto-dismiss qua Provider duration; ta chi quan ly hang doi
 * va dispatch dismiss khi onOpenChange tu Radix bao toast da dong.
 */
export interface ToastItem {
  id: string;
  variant: 'default' | 'destructive';
  title: string | undefined;
  description: string | undefined;
}

export interface ToastInput {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

type Listener = (toasts: ToastItem[]) => void;

const MAX_TOASTS = 5;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener([...toasts]);
}

/** Enqueue mot toast moi. Tra ve id de caller co the dismiss thu cong. */
export function toast(input: ToastInput): string {
  const id = Math.random().toString(36).slice(2);
  const item: ToastItem = {
    id,
    variant: input.variant ?? 'default',
    title: input.title,
    description: input.description,
  };
  toasts = [item, ...toasts].slice(0, MAX_TOASTS);
  emit();
  return id;
}

/** Xoa mot toast khoi hang doi (goi khi Radix onOpenChange(false)). */
export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** React hook subscribe vao hang doi toast. */
export function useToast(): {
  toasts: ToastItem[];
  toast: typeof toast;
  dismiss: typeof dismissToast;
} {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return { toasts: items, toast, dismiss: dismissToast };
}
