import { CreditCard } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 12 - billing (plans, subscriptions, payment methods).
export function BillingPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Quan ly goi va phuong thuc thanh toan.</p>
      </header>
      <EmptyState
        icon={CreditCard}
        title="Tinh nang dang duoc xay dung"
        description="Billing se duoc lam trong Phase 12."
      />
    </div>
  );
}
