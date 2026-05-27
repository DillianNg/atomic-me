import { useAuth } from '@clerk/clerk-react';

export interface AppSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
}

/**
 * Wrap Clerk useAuth de phan con lai cua app khong phu thuoc truc tiep API Clerk.
 * Expose getToken cho api-client gan Bearer token.
 */
export function useSession(): AppSession {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    getToken: () => getToken(),
  };
}
