import { File as FileIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface FilePreviewProps {
  file: File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Card hien thi metadata cua file truoc khi upload (ten, size, type). */
export function FilePreview({ file }: FilePreviewProps) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <FileIcon className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSize(file.size)} - {file.type || 'unknown'}
        </p>
      </div>
    </Card>
  );
}
