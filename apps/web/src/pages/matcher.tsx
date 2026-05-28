import { Target } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 10 - JD matcher (parse JD, rerank atoms, gap detection).
export function MatcherPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Matcher</h1>
        <p className="text-sm text-muted-foreground">
          Dan JD vao, he thong rerank atoms va phat hien gap.
        </p>
      </header>
      <EmptyState
        icon={Target}
        title="Tinh nang dang duoc xay dung"
        description="JD matcher se san sang trong Phase 10."
      />
    </div>
  );
}
