import { useUser as useClerkUser } from '@clerk/clerk-react';

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string;
}

export interface UseUserResult {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AppUser | null;
}

/** Wrap Clerk useUser ve shape gon cua app (tranh leak shape Clerk khap noi). */
export function useUser(): UseUserResult {
  const { isLoaded, isSignedIn, user } = useClerkUser();
  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          name: user.fullName,
          imageUrl: user.imageUrl,
        }
      : null,
  };
}
