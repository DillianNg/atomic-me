import { SignIn } from '@clerk/clerk-react';
import type { ReactElement } from 'react';

/**
 * Wrap Clerk <SignIn> (path routing) de dung trong route /sign-in.
 * Sau khi dang nhap thanh cong, redirect ve /upload.
 */
export function SignInButton(): ReactElement {
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/upload" />;
}
