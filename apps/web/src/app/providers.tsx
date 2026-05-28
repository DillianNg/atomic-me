import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';

/**
 * Provider chain ngoai cung (theo thu tu boc):
 *   ErrorBoundary -> QueryClient -> Tooltip -> children -> Toaster.
 * ClerkProvider duoc mount o main.tsx (ngoai cua App).
 * Theme do zustand store quan ly (apply class .dark len <html> tu inline script
 * index.html va onRehydrateStorage).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
