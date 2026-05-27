import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gop class Tailwind (shadcn pattern): clsx + merge de tranh class trung/lan nhau. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
