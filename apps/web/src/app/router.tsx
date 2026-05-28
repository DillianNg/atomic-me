import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AssessmentPage } from '@/pages/assessment';
import { BillingPage } from '@/pages/billing';
import { CreditsPage } from '@/pages/credits';
import { LedgerPage } from '@/pages/ledger';
import { MatcherPage } from '@/pages/matcher';
import { OptimizerPage } from '@/pages/optimizer';
import { SettingsPage } from '@/pages/settings';
import { SignInPage } from '@/pages/sign-in';
import { SignUpPage } from '@/pages/sign-up';
import { UploadPage } from '@/pages/upload';

/**
 * Routes:
 * - /sign-in/*, /sign-up/* : public (Clerk path routing -> splat).
 * - protected: bao boi ProtectedRoute + AppLayout (Sidebar + TopBar).
 *   / redirect toi /upload.
 * - * fallback ve /.
 */
export const router = createBrowserRouter([
  { path: '/sign-in/*', element: <SignInPage /> },
  { path: '/sign-up/*', element: <SignUpPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <Navigate to="/upload" replace /> },
      { path: '/upload', element: <UploadPage /> },
      { path: '/ledger', element: <LedgerPage /> },
      { path: '/matcher', element: <MatcherPage /> },
      { path: '/optimizer', element: <OptimizerPage /> },
      { path: '/assessment', element: <AssessmentPage /> },
      { path: '/credits', element: <CreditsPage /> },
      { path: '/billing', element: <BillingPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
