import { Outlet } from 'react-router-dom';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { PageContainer } from '@/components/layout/PageContainer';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

/**
 * Layout cho khu vuc protected: Sidebar + TopBar + content area.
 * ErrorBoundary bao quanh content de mot trang loi khong sap ca app.
 */
export function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <PageContainer>
              <Outlet />
            </PageContainer>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
