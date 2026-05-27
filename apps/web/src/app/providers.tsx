import { QueryClientProvider } from '@tanstack/react-query';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { queryClient } from '../lib/query-client';

/** ThemeProvider toi gian (basic). Mo rong theme/dark-mode o Phase sau. */
function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  return (
    <div data-theme="light" className="min-h-screen bg-white text-slate-900">
      {children}
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Error boundary ngoai cung: chan loi render de khong trang trang. */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-slate-500">Please reload the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Gop provider toan app: ErrorBoundary -> QueryClient -> Theme. */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
