import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gop class Tailwind (shadcn pattern): clsx + merge de tranh class trung/lan nhau. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format ngay theo locale, mac dinh 'en-US'. Nhan Date | ISO string | epoch ms. */
export function formatDate(value: Date | string | number, locale = 'en-US'): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

/** Cat chuoi neu vuot do dai, gan suffix (mac dinh '...'). */
export function truncate(text: string, max: number, suffix = '...'): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - suffix.length)) + suffix;
}
