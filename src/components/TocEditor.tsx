import React, { useState } from "react";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { type TocEntry } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";

interface TocEditorProps {
  entries: TocEntry[];
  onChange: (entries: TocEntry[]) => void;
  totalPages: number;
  onEntryClick: (page: number) => void;
  fileName?: string;
  globalOffset: number;
  onOffsetChange: (offset: number) => void;
  hasExistingToc?: boolean;
  existingTocCount?: number;
}

export function TocEditor({ entries, onChange, totalPages, onEntryClick, fileName, globalOffset, onOffsetChange, hasExistingToc, existingTocCount }: TocEditorProps) {
  const [calcPhys, setCalcPhys] = useState<number | ''>('');
  const [calcLog, setCalcLog] = useState<number | ''>('');

  const handleCalcPhys = (val: string) => {
    const p = parseInt(val);
    setCalcPhys(isNaN(p) ? '' : p);
    if (!isNaN(p) && typeof calcLog === 'number') {
      onOffsetChange(p - calcLog);
    }
  };

  const handleCalcLog = (val: string) => {
    const l = parseInt(val);
    setCalcLog(isNaN(l) ? '' : l);
    if (!isNaN(l) && typeof calcPhys === 'number') {
      onOffsetChange(calcPhys - l);
    }
  };

  const updateEntry = (idx: number, field: keyof TocEntry, value: string | number) => {
    const updated = [...entries];
    if (field === 'page') {
      updated[idx] = { ...updated[idx], page: Number(value) || 0 };
    } else if (field === 'level') {
      updated[idx] = { ...updated[idx], level: Number(value) || 1 };
    } else {
      updated[idx] = { ...updated[idx], title: String(value) };
    }
    onChange(updated);
  };

  const deleteEntry = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    onChange([...entries, { title: "새 항목", page: 1, level: 1 }]);
  };

  return (
    <div style={{
      backgroundColor: "var(--color-background)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "var(--color-card)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>목차 ({entries.length}개)</h3>
        <Button size="sm" variant="ghost" onClick={addEntry} style={{ fontSize: 12, gap: 4 }}>
          <Plus style={{ width: 14, height: 14 }} /> 추가
        </Button>
      </div>

      {/* Always show offset control when PDF is loaded */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: "#fafafa",
      }}>
        {/* Direct Offset Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-foreground)", whiteSpace: "nowrap" }}>수동 오프셋:</span>
          <input
            type="number"
            value={globalOffset}
            onChange={e => {
              onOffsetChange(parseInt(e.target.value) || 0);
              setCalcPhys(''); setCalcLog(''); // Reset auto-calc
            }}
            style={{
              width: 60, height: 26, borderRadius: 4, border: "1px solid var(--color-input)",
              padding: "2px 8px", fontSize: 13, textAlign: "center",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--color-muted-foreground)", lineHeight: 1.4 }}>
            {globalOffset > 0 && `(PDF 1~${globalOffset}쪽: 로마숫자, PDF ${globalOffset + 1}쪽부터 책 "1"쪽)`}
            {globalOffset === 0 && `(PDF 1쪽 = 책 "1"쪽)`}
            {globalOffset < 0 && `(PDF 1쪽 = 책 "${1 - globalOffset}"쪽)`}
          </span>
        </div>

        {/* Auto Calculator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", backgroundColor: "var(--color-card)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 12, color: "var(--color-muted-foreground)", marginRight: 4 }}>💡 <strong>자동 계산기:</strong></span>
          <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>PDF</span>
          <input
            type="number"
            value={calcPhys}
            onChange={e => handleCalcPhys(e.target.value)}
            placeholder="예: 11"
            style={{ width: 50, height: 24, fontSize: 12, textAlign: "center", border: "1px solid var(--color-input)", borderRadius: 4 }}
          />
          <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>쪽 = 책</span>
          <input
            type="number"
            value={calcLog}
            onChange={e => handleCalcLog(e.target.value)}
            placeholder="예: 1"
            style={{ width: 50, height: 24, fontSize: 12, textAlign: "center", border: "1px solid var(--color-input)", borderRadius: 4 }}
          />
          <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>쪽</span>
        </div>
      </div>

      {/* Entry list */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted-foreground)", padding: "24px 16px", textAlign: "center", lineHeight: 1.5 }}>
            {hasExistingToc ? (
              <>
                <strong>이 PDF 파일에는 목차가 이미 포함되어 있습니다 ({existingTocCount}개).</strong><br />
                목차를 유지한 채 페이지 라벨(오프셋)만 변경하려면,<br/>"PDF 생성 & 저장" 버튼을 바로 누르시면 됩니다.
              </>
            ) : (
              'PDF를 올리고 "AI 감지"를 눌러주세요.'
            )}
          </p>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderBottom: "1px solid #f0f0f0",
                fontSize: 13,
              }}
            >
              <GripVertical style={{ width: 14, height: 14, color: "#ccc", flexShrink: 0 }} />
              
              {/* Level */}
              <select
                value={entry.level}
                onChange={e => updateEntry(idx, 'level', e.target.value)}
                style={{
                  width: 42,
                  height: 28,
                  borderRadius: 4,
                  border: "1px solid var(--color-input)",
                  fontSize: 12,
                  flexShrink: 0,
                  backgroundColor: "white",
                }}
              >
                <option value={1}>H1</option>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
                <option value={4}>H4</option>
              </select>

              {/* Title */}
              <input
                type="text"
                value={entry.title}
                onChange={e => updateEntry(idx, 'title', e.target.value)}
                style={{
                  flex: 1,
                  height: 28,
                  borderRadius: 4,
                  border: "1px solid var(--color-input)",
                  padding: "2px 8px",
                  fontSize: 13,
                  minWidth: 0,
                }}
              />

              {/* Page number */}
              <input
                type="number"
                value={entry.page}
                onChange={e => updateEntry(idx, 'page', e.target.value)}
                style={{
                  width: 56,
                  height: 28,
                  borderRadius: 4,
                  border: "1px solid var(--color-input)",
                  padding: "2px 6px",
                  fontSize: 13,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              />

              {/* Preview link */}
              <button
                onClick={() => onEntryClick(Math.max(1, entry.page + globalOffset))}
                title={`물리 페이지 ${Math.max(1, entry.page + globalOffset)} 보기`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--color-primary)",
                  textDecoration: "underline",
                  flexShrink: 0,
                }}
              >
                보기
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteEntry(idx)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  flexShrink: 0,
                }}
              >
                <Trash2 style={{ width: 14, height: 14, color: "#dc2626" }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
