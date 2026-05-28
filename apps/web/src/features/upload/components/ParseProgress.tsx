import { cn } from '@/lib/utils';

import type { UploadProgress, UploadStage } from '../types';

interface ParseProgressProps {
  stage: UploadStage;
  progress: UploadProgress | null;
}

const STAGE_LABEL: Record<UploadStage, string> = {
  idle: 'Sang sang',
  requesting: 'Dang xin URL upload...',
  uploading: 'Dang tai len R2...',
  confirming: 'Dang xac nhan...',
  done: 'Hoan tat',
  error: 'Co loi xay ra',
};

/**
 * Hien progress bar + nhan stage hien tai.
 * Phase 5 chi co upload progress; Phase 6 se them parse status + atom count.
 */
export function ParseProgress({ stage, progress }: ParseProgressProps) {
  const percent =
    stage === 'uploading' && progress
      ? progress.percent
      : stage === 'done' || stage === 'confirming'
        ? 100
        : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{STAGE_LABEL[stage]}</span>
        {stage === 'uploading' && <span className="text-muted-foreground">{percent}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-200',
            stage === 'error' ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* TODO: Phase 6 - parse status + atom count sau khi parser worker xong */}
    </div>
  );
}
