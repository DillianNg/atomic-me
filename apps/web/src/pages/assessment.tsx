import { GitMerge } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 11 - assessment / quality review of generated outputs.
export function AssessmentPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Assessment</h1>
        <p className="text-sm text-muted-foreground">
          Danh gia chat luong output va evidence traceability.
        </p>
      </header>
      <EmptyState
        icon={GitMerge}
        title="Tinh nang dang duoc xay dung"
        description="Assessment se san sang sau Optimizer (Phase 11+)."
      />
    </div>
  );
}
