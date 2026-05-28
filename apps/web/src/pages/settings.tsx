import { Settings as SettingsIcon } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 12 - settings (profile, preferences, integrations).
export function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Tuy chinh tai khoan va ung dung.</p>
      </header>
      <EmptyState
        icon={SettingsIcon}
        title="Tinh nang dang duoc xay dung"
        description="Settings UI day du se duoc lam trong Phase 12."
      />
    </div>
  );
}
