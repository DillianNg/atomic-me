import { QueryClient } from '@tanstack/react-query';

import { ApiClientError } from './api-client';

/**
 * TanStack Query client.
 * Khong retry loi auth (401/403): retry vo ich va lam cham phan hoi loi.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
