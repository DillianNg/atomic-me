import { UploadCloud } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';

// TODO: Phase 5 - upload flow (CV/JD/asset, parse, decompose into atoms).
export function UploadPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Upload</h1>
        <p className="text-sm text-muted-foreground">
          Tai len CV, cover letter, va cac asset khac de phan ra thanh atoms.
        </p>
      </header>
      <EmptyState
        icon={UploadCloud}
        title="Tinh nang dang duoc xay dung"
        description="Upload va parse asset se san sang trong Phase 5."
      />
    </div>
  );
}
