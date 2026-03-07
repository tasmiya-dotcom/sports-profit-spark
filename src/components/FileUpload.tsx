import { useCallback } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileLoad: (buffer: ArrayBuffer) => void;
}

const FileUpload = ({ onFileLoad }: FileUploadProps) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onFileLoad(e.target.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) readFile(file);
        };
        input.click();
      }}
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
