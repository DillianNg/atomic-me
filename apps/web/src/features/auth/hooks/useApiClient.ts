import { useMemo } from 'react';

import { type ApiClient, createApiClient } from '../../../lib/api-client';

import { useSession } from './useSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/** Tao ApiClient gan voi token cua session hien tai (memo theo getToken). */
export function useApiClient(): ApiClient {
  const { getToken } = useSession();
  return useMemo(() => createApiClient(API_BASE_URL, getToken), [getToken]);
}
