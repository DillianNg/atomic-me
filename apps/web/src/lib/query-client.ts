import { QueryClient } from '@tanstack/react-query';

import { ApiClientError } from './api-client';

/**
 * TanStack Query client.
 * - Queries: retry 1 lan, tru loi auth (401/403) -> retry vo ich.
 * - Mutations: KHONG retry (tranh side-effect 2 lan).
 * - staleTime 30s, refetch on window focus tat de UX yen ang.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
