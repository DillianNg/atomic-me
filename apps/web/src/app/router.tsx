import { Navigate, createBrowserRouter } from 'react-router-dom';

import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';

import { RootLayout } from './RootLayout';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { UploadPage } from './pages/UploadPage';

/**
 * Routes:
 * - /sign-in/*, /sign-up/*: public (Clerk path routing -> can splat).
 * - / : protected, redirect toi /upload.
 * - /upload : protected placeholder (Phase 4).
 * - * : ve /.
 */
export const router = createBrowserRouter([
  { path: '/sign-in/*', element: <SignInPage /> },
  { path: '/sign-up/*', element: <SignUpPage /> },
  {
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <Navigate to="/upload" replace /> },
      { path: '/upload', element: <UploadPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
