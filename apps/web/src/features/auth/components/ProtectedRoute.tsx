import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSession } from '../hooks/useSession';

/**
 * Bao ve route: chua load xong -> skeleton; chua dang nhap -> redirect /sign-in.
 */
export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { isLoaded, isSignedIn } = useSession();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}
