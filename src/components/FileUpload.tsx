import { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileLoad: (buffer: ArrayBuffer, fileName: string) => void;
}

const FileUpload = ({ onFileLoad }: FileUploadProps) => {
  const onFileLoadRef = useRef(onFileLoad);
  onFileLoadRef.current = onFileLoad;

  const readFile = useCallback((file: File) => {
    console.log('Reading file:', file.name, 'size:', file.size);
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('FileReader loaded, result type:', typeof e.target?.result);
      if (e.target?.result) {
        onFileLoadRef.current(e.target.result as ArrayBuffer, file.name);
      }
    };
    reader.onerror = (e) => {
      console.error('FileReader error:', e);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) readFile(file);
    };
    input.click();
  }, [readFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={handleClick}
      className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
    >
      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Drop Excel file or <span className="text-primary font-medium">click to browse</span>
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">Sheets: Report, Market Pattern, Rejection Detail, Raw Data</p>
    </div>
  );
};

export default FileUpload;
