import { UserButton } from '@clerk/clerk-react';
import { Outlet } from 'react-router-dom';

/** Layout chung cho khu vuc protected. Header + UserButton (sign-out) + Outlet. */
export function RootLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <span className="font-semibold">Atomic Me</span>
        <UserButton />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
