import React, { useEffect, useRef } from "react";
import * as pdfjsLib from 'pdfjs-dist';

interface PdfPreviewProps {
  pdfBytes: Uint8Array | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function PdfPreview({ pdfBytes, totalPages, currentPage, onPageChange }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdfBytes || !canvasRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      try {
        // Always create a fresh copy to avoid detached buffer issues
        const copy = pdfBytes.slice();
        const doc = await pdfjsLib.getDocument({ data: copy }).promise;
        if (cancelled) return;
        const page = await doc.getPage(Math.min(currentPage, totalPages));
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await (page.render({
          canvasContext: context,
          viewport: viewport,
        } as any) as any).promise;
      } catch (err) {
        if (!cancelled) console.error("PDF Render Error:", err);
      }
    };
    renderPage();

    return () => { cancelled = true; };
  }, [pdfBytes, currentPage, totalPages]);

  if (!pdfBytes) return <div style={{ padding: 32, textAlign: "center", color: "var(--color-muted-foreground)" }}>PDF Preview</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--color-accent)" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-card)",
      }}>
        <button 
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          style={{
            padding: "4px 12px",
            fontSize: 12,
            backgroundColor: "var(--color-secondary)",
            border: "none",
            borderRadius: 4,
            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
            opacity: currentPage <= 1 ? 0.5 : 1,
          }}
        >
          이전
        </button>
        <span style={{ fontSize: 12 }}>
          {currentPage} / {totalPages}
        </span>
        <button 
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          style={{
            padding: "4px 12px",
            fontSize: 12,
            backgroundColor: "var(--color-secondary)",
            border: "none",
            borderRadius: 4,
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
            opacity: currentPage >= totalPages ? 0.5 : 1,
          }}
        >
          다음
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <canvas ref={canvasRef} style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxWidth: "100%" }} />
      </div>
    </div>
  );
}
