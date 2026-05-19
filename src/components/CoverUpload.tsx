import React from "react";
import { ImagePlus, X } from "lucide-react";

export function CoverUpload({ coverImage, onCoverChange }: { coverImage: string | null, onCoverChange: (img: string | null) => void }) {
  return (
    <div 
      style={{
        border: "2px dashed var(--color-border)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        width: "100%",
      }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (ev) => {
          const files = (ev.target as HTMLInputElement).files;
          if (files && files[0]) {
            const url = URL.createObjectURL(files[0]);
            onCoverChange(url);
          }
        };
        input.click();
      }}
    >
      <ImagePlus style={{ width: 24, height: 24, color: "var(--color-muted-foreground)", marginBottom: 8 }} />
      {coverImage ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#16a34a" }}>커버 이미지 등록됨</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onCoverChange(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
          >
            <X style={{ width: 14, height: 14, color: "#dc2626" }} />
          </button>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>커버 이미지 업로드 (선택)</span>
      )}
    </div>
  );
}
