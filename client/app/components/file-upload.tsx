'use client';
import * as React from 'react';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';

type Status = 'idle' | 'uploading' | 'done';

const FileUploadComponent: React.FC = () => {
  const [status, setStatus] = React.useState<Status>('idle');
  const [fileName, setFileName] = React.useState<string>('');

  const handleFileUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type', 'file');
    el.setAttribute('accept', 'application/pdf');
    el.addEventListener('change', async () => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        if (file) {
          setFileName(file.name);
          setStatus('uploading');

          const formData = new FormData();
          formData.append('pdf', file);

          try {
            await fetch('http://localhost:8000/upload/pdf', {
              method: 'POST',
              body: formData,
            });
            setStatus('done');
          } catch {
            setStatus('idle');
          }
        }
      }
    });
    el.click();
  };

  return (
    <div
      onClick={handleFileUploadButtonClick}
      className="group cursor-pointer rounded-xl border-2 border-dashed border-[#2a2a3a] bg-[#12121a] p-6 text-center transition-colors hover:border-[#6c47ff]"
    >
      <div className="flex flex-col items-center gap-2 text-[#8b8ba0] group-hover:text-[#e8e8ec]">
        {status === 'uploading' ? (
          <>
            <Loader2 className="animate-spin" size={22} />
            <p className="text-sm">Uploading {fileName}…</p>
          </>
        ) : status === 'done' ? (
          <>
            <CheckCircle2 className="text-[#6c47ff]" size={22} />
            <p className="text-sm">{fileName} uploaded — indexing in background</p>
            <p className="text-xs text-[#5c5c6e]">Click to upload another</p>
          </>
        ) : (
          <>
            <Upload size={22} />
            <p className="text-sm font-medium">Upload PDF file</p>
            <p className="text-xs text-[#5c5c6e]">Click to browse</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploadComponent;