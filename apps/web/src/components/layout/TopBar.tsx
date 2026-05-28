import { useClerk } from '@clerk/clerk-react';
import { LogOut, Moon, Sun, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/features/auth/hooks/useUser';
import { useUiStore } from '@/stores/ui';

const ROUTE_TITLES: Record<string, string> = {
  '/upload': 'Upload',
  '/ledger': 'Ledger',
  '/matcher': 'Matcher',
  '/optimizer': 'Optimizer',
  '/assessment': 'Assessment',
  '/credits': 'Credits',
  '/billing': 'Billing',
  '/settings': 'Settings',
};

function titleFromPath(pathname: string): string {
  for (const [prefix, label] of Object.entries(ROUTE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return label;
  }
  return 'Atomic Me';
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const sysDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && sysDark);

  const title = titleFromPath(location.pathname);
  const initial = (user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium md:flex">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span>20 credits</span>
        </div>

        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User menu"
              className="inline-flex h-9 items-center gap-2 rounded-md px-1 hover:bg-accent"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name ?? 'Anonymous'}</span>
                <span className="text-xs text-muted-foreground">{user?.email ?? ''}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void signOut();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
