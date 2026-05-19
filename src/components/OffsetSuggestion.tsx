import React from "react";
import { ArrowRight, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TocEntry } from "@/lib/pdf-utils";

interface OffsetSuggestionProps {
  suggestion: {
    offset: number;
    reasoning: string;
    sampleTitle: string;
    bookPage: number;
    pdfPage: number;
  } | null;
  analyzing: boolean;
  onApply: (offset: number) => void;
  onDismiss: () => void;
}

export function OffsetSuggestion({ suggestion, analyzing, onApply, onDismiss }: OffsetSuggestionProps) {
  if (analyzing) {
    return (
      <div style={{
        border: "1px solid #c4b5fd",
        borderRadius: 12,
        padding: "16px 20px",
        backgroundColor: "#f5f3ff",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 20, height: 20,
          border: "2px solid #7c3aed",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <span style={{ fontSize: 13, color: "#5b21b6" }}>
          AI가 페이지 오프셋을 분석하고 있습니다...
        </span>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <div style={{
      border: "1px solid #c4b5fd",
      borderRadius: 12,
      padding: "16px 20px",
      backgroundColor: "#f5f3ff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Info style={{ width: 16, height: 16, color: "#7c3aed" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#5b21b6" }}>AI 페이지 오프셋 제안</span>
      </div>

      <div style={{
        backgroundColor: "white",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 12,
        border: "1px solid #e9e5f5",
      }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: "#6b7280" }}>분석 근거: </span>
          <span style={{ fontWeight: 500 }}>"{suggestion.sampleTitle}"</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{
            backgroundColor: "#ede9fe",
            padding: "2px 8px",
            borderRadius: 4,
            fontWeight: 500,
          }}>
            책 p.{suggestion.bookPage}
          </span>
          <ArrowRight style={{ width: 14, height: 14, color: "#9ca3af" }} />
          <span style={{
            backgroundColor: "#dbeafe",
            padding: "2px 8px",
            borderRadius: 4,
            fontWeight: 500,
          }}>
            PDF p.{suggestion.pdfPage}
          </span>
          <span style={{ color: "#6b7280", marginLeft: 4 }}>
            → 오프셋: <strong>+{suggestion.offset}</strong>
          </span>
        </div>
        {suggestion.reasoning && (
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.4 }}>
            {suggestion.reasoning}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button
          size="sm"
          onClick={() => onApply(suggestion.offset)}
          style={{ backgroundColor: "#7c3aed", color: "white", gap: 4, fontSize: 12 }}
        >
          <Check style={{ width: 14, height: 14 }} />
          오프셋 +{suggestion.offset} 적용
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} style={{ fontSize: 12 }}>
          무시
        </Button>
      </div>
    </div>
  );
}
