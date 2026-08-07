'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface ReceiptUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function ReceiptUploadZone({ onFilesSelected }: ReceiptUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null | undefined) {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList));
  }

  return (
    <div
      data-testid="receipt-upload-zone"
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
        isDragging ? 'border-gold bg-gold/5' : 'border-neutral-200'
      }`}
    >
      <UploadCloud className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
      <p className="text-sm font-medium text-neutral-700">Tap to upload or drag a receipt here</p>
      <p className="text-xs text-neutral-400">Images or PDF</p>
      <input
        ref={inputRef}
        data-testid="receipt-file-input"
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
