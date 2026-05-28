import { Wallet } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 12 - credit ledger view (balance, transactions, earn actions).
export function CreditsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Credits</h1>
        <p className="text-sm text-muted-foreground">
          So credit hien tai, lich su giao dich, cach kiem them.
        </p>
      </header>
      <EmptyState
        icon={Wallet}
        title="Tinh nang dang duoc xay dung"
        description="Credit ledger se duoc lam trong Phase 12."
      />
    </div>
  );
}
