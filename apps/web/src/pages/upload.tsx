import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilePreview } from '@/features/upload/components/FilePreview';
import { ParseProgress } from '@/features/upload/components/ParseProgress';
import { UploadDropzone } from '@/features/upload/components/UploadDropzone';
import { useUploadAsset } from '@/features/upload/hooks/useUploadAsset';

// TODO: Phase 6 - hien parse result + atoms sau khi worker xu ly xong asset.
export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const { stage, progress, error, result, upload, reset } = useUploadAsset();

  const inProgress = stage === 'requesting' || stage === 'uploading' || stage === 'confirming';
  const done = stage === 'done';
  const failed = stage === 'error';

  const handleReset = (): void => {
    setFile(null);
    reset();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Upload</h1>
        <p className="text-sm text-muted-foreground">
          Tai len CV, JD hoac asset khac de phan ra thanh atoms.
        </p>
      </header>

      {!file && <UploadDropzone onFileSelect={setFile} />}

      {file && (
        <div className="space-y-4">
          <FilePreview file={file} />

          {(inProgress || done || failed) && <ParseProgress stage={stage} progress={progress} />}

          {error && (
            <Card className="border-destructive p-4 text-sm text-destructive">
              {error.message}
            </Card>
          )}

          {done && result && (
            <Card className="p-4 text-sm">
              Upload thanh cong. Asset ID:{' '}
              <span className="font-mono text-xs">{result.id}</span>
            </Card>
          )}

          <div className="flex gap-2">
            {!done && (
              <Button onClick={() => void upload(file)} disabled={inProgress}>
                {inProgress ? 'Dang xu ly...' : 'Upload'}
              </Button>
            )}
            <Button variant="outline" onClick={handleReset} disabled={inProgress}>
              {done ? 'Upload them' : 'Huy'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
