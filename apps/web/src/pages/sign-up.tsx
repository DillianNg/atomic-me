import { SignUp } from '@clerk/clerk-react';

export function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/upload" />
    </div>
  );
}
