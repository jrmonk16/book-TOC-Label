import React, { useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";

export function PdfDropZone({ onFileSelect, currentFile }: { onFileSelect: (f: File) => void, currentFile: File | null }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  return (
    <div 
      style={{
        border: isDragging ? "2px dashed var(--color-primary)" : "2px dashed var(--color-border)",
        borderRadius: "12px",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        minHeight: "140px",
        backgroundColor: isDragging ? "rgba(59, 130, 246, 0.08)" : "transparent",
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf";
        input.onchange = (ev) => {
          const files = (ev.target as HTMLInputElement).files;
          if (files && files[0]) onFileSelect(files[0]);
        };
        input.click();
      }}
    >
      <UploadCloud style={{ width: 40, height: 40, marginBottom: 16, color: isDragging ? "var(--color-primary)" : "var(--color-muted-foreground)" }} />
      {currentFile ? (
        <p style={{ fontSize: 14, fontWeight: 500 }}>{currentFile.name}</p>
      ) : (
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-muted-foreground)" }}>
          {isDragging ? "여기에 PDF를 놓으세요!" : "클릭하거나 PDF를 드래그 앤 드롭 하세요."}
        </p>
      )}
    </div>
  );
}
