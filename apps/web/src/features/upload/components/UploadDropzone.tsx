import { UploadCloud } from 'lucide-react';
import { type ChangeEvent, type DragEvent, useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

/**
 * Dropzone ho tro click chon va keo-tha. Khong tu validate (de useUploadAsset
 * + backend xu ly), de UI tap trung vao tuong tac.
 */
export function UploadDropzone({ onFileSelect, accept, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [disabled, onFileSelect],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Cho phep chon lai cung file (otherwise onChange khong fire).
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors',
        isDragging ? 'border-primary bg-accent/40' : 'border-border bg-muted/20 hover:bg-accent/30',
        disabled && 'pointer-events-none opacity-60',
      )}
      aria-disabled={disabled}
    >
      <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">Click hoac keo tha file vao day</p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, hinh anh, audio, zip, text. Toi da 25 MB.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
