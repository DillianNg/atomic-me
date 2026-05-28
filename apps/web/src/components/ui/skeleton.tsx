import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Box mau xam pulse, dung cho cac loading state. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
