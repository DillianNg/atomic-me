import { Layers } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 9 - atom ledger (list, filter, evidence trace, merge/verify).
export function LedgerPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <p className="text-sm text-muted-foreground">
          So cai atoms cua ban: skills, achievements, projects, credentials.
        </p>
      </header>
      <EmptyState
        icon={Layers}
        title="Tinh nang dang duoc xay dung"
        description="Atom ledger se duoc lam trong Phase 9."
      />
    </div>
  );
}
