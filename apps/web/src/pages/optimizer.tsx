import { Sparkles } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 11 - tailored CV / cover letter generation from atoms + JD.
export function OptimizerPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Optimizer</h1>
        <p className="text-sm text-muted-foreground">
          Tao CV / cover letter tuy chinh tu atoms khop voi JD.
        </p>
      </header>
      <EmptyState
        icon={Sparkles}
        title="Tinh nang dang duoc xay dung"
        description="Optimizer se duoc lam trong Phase 11."
      />
    </div>
  );
}
