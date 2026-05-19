import React, { useState, useCallback, useEffect } from "react";
import { Download, Loader2, FileText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfDropZone } from "@/components/PdfDropZone";
import { CoverUpload } from "@/components/CoverUpload";
import { TocEditor } from "@/components/TocEditor";
import { PdfPreview } from "@/components/PdfPreview";
import { OffsetSuggestion } from "@/components/OffsetSuggestion";
import { extractTextFromPdf, getPdfPageCount, extractExistingToc, type TocEntry } from "@/lib/pdf-utils";
import { addTocToPdf } from "@/lib/pdf-generator";
import { Toaster, toast } from "sonner";

interface OffsetSuggestionData {
  offset: number;
  reasoning: string;
  sampleTitle: string;
  bookPage: number;
  pdfPage: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [showLlmModal, setShowLlmModal] = useState(false);
  // Provider: "ollama" | "gemini"
  const [provider, setProvider] = useState<"ollama" | "gemini">("gemini");
  // Ollama settings
  const [llmUrl, setLlmUrl] = useState("http://localhost:11434/api/generate");
  const [llmModel, setLlmModel] = useState("gemma3:27b");
  // Gemini settings
  const [geminiKey, setGeminiKey] = useState<string>(
    (import.meta as any).env?.VITE_GEMINI_API_KEY || ""
  );
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  // Available Ollama models (fetched from /api/tags)
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string>("");

  // TOC page range (user can specify)
  const [tocStartPage, setTocStartPage] = useState(1);
  const [tocEndPage, setTocEndPage] = useState(10);

  // Global Page Offset
  const [globalOffset, setGlobalOffset] = useState(0);

  // Offset suggestion state
  const [offsetSuggestion, setOffsetSuggestion] = useState<OffsetSuggestionData | null>(null);
  const [analyzingOffset, setAnalyzingOffset] = useState(false);
  // Store extracted text for reuse in offset analysis
  const [extractedText, setExtractedText] = useState<string>("");
  const [hasExistingToc, setHasExistingToc] = useState<number>(0);

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    const buffer = await f.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setPdfBytes(bytes);
    setOffsetSuggestion(null);
    setExtractedText("");
    setHasExistingToc(0);
    setEntries([]);
    setGlobalOffset(0);
    try {
      const pages = await getPdfPageCount(bytes.slice().buffer);
      setTotalPages(pages);
      setPreviewPage(1);

      let existing: TocEntry[] = [];
      try {
        existing = await Promise.race([
          extractExistingToc(bytes.slice().buffer),
          new Promise<TocEntry[]>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
        ]);
      } catch (tocErr) {
        console.warn("Failed to extract existing TOC (timeout or error):", tocErr);
      }

      if (existing.length > 0) {
        setHasExistingToc(existing.length);
        toast.success(`PDF 로드 완료: ${pages}페이지 (기존 목차 ${existing.length}개 발견)`);
      } else {
        toast.success(`PDF 로드 완료: ${pages}페이지`);
      }
    } catch (err: any) {
      console.error("PDF Load Error:", err);
      toast.error("PDF를 읽을 수 없습니다: " + (err.message || ""));
    }
  }, []);

  // Global drag and drop prevention & window-level drop handling
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith('.pdf')) {
          handleFileSelect(droppedFile).catch(err => {
             console.error("handleFileSelect error:", err);
             toast.error("파일 처리 중 오류: " + err.message);
          });
        } else {
          toast.error("PDF 파일만 지원됩니다.");
        }
      }
    };
    document.addEventListener('dragenter', preventDefaults);
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('dragleave', preventDefaults);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', preventDefaults);
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('dragleave', preventDefaults);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleFileSelect]);

  // Fetch installed Ollama model list from /api/tags
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true);
    setOllamaError("");
    try {
      // Derive /api/tags from the configured URL (replace /api/generate or similar)
      const tagsUrl = llmUrl.replace(/\/api\/.*$/, "/api/tags");
      const res = await fetch(tagsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const names: string[] = (data?.models || []).map((m: any) => m.name).filter(Boolean);
      setOllamaModels(names);
      if (names.length > 0 && !names.includes(llmModel)) {
        setLlmModel(names[0]);
      }
    } catch (err: any) {
      setOllamaError(`Ollama 연결 실패: ${err.message || err}`);
      setOllamaModels([]);
    } finally {
      setOllamaLoading(false);
    }
  }, [llmUrl, llmModel]);

  // Auto-fetch when user opens modal and switches to Ollama
  useEffect(() => {
    if (showLlmModal && provider === "ollama") {
      fetchOllamaModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLlmModal, provider]);

  // Unified LLM call that returns the raw text response, branching by provider.
  const callLLM = useCallback(async (prompt: string): Promise<string> => {
    if (provider === "gemini") {
      if (!geminiKey) throw new Error("Gemini API 키가 비어 있습니다. .env의 VITE_GEMINI_API_KEY를 확인하거나 모달에서 입력하세요.");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini API 오류 (HTTP ${res.status}): ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error("Gemini 응답에서 텍스트를 찾지 못했습니다.");
      }
      return text;
    } else {
      const res = await fetch(llmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: llmModel, prompt, stream: false }),
      });
      if (!res.ok) throw new Error(`Ollama 서버 응답 오류: HTTP ${res.status}`);
      const data = await res.json();
      return data.response || "";
    }
  }, [provider, llmUrl, llmModel, geminiKey, geminiModel]);

  // Analyze offset: after TOC is detected, ask AI to match a TOC entry to a physical PDF page
  const analyzeOffset = useCallback(async (detectedEntries: TocEntry[], pdfText: string) => {
    if (detectedEntries.length === 0) return;
    setAnalyzingOffset(true);
    setOffsetSuggestion(null);

    try {
      const sample = detectedEntries.find(e => e.page > 0 && e.level === 1) || detectedEntries.find(e => e.page > 0) || detectedEntries[0];

      const prompt = `다음은 PDF에서 추출한 텍스트입니다. 각 페이지는 "--- Page N ---" 마커로 구분되어 있으며, 이 N은 PDF의 실제 쪽수입니다.

목차에서 감지한 항목 중 하나:
- 제목: "${sample.title}"
- 책에 인쇄된 쪽수: ${sample.page}

이 제목("${sample.title}")의 내용이 실제로 PDF의 몇 번째 쪽(--- Page N ---)에 나타나는지 찾아주세요.
그리고 책 쪽수와 PDF 쪽수 사이의 차이(오프셋 = PDF 쪽 - 책 쪽)를 계산해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{"pdf_page": PDF쪽수, "book_page": ${sample.page}, "offset": 차이값, "reasoning": "간단한 설명"}

텍스트:
${pdfText}`;

      const rawResponse = await callLLM(prompt);
      let cleanResponse = rawResponse.trim();
      cleanResponse = cleanResponse.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      const objMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (objMatch) {
        cleanResponse = objMatch[0];
      }

      const result = JSON.parse(cleanResponse);
      const offset = Number(result.offset || 0);
      const pdfPage = Number(result.pdf_page || 0);

      setOffsetSuggestion({
        offset: offset,
        reasoning: result.reasoning || "",
        sampleTitle: sample.title,
        bookPage: sample.page,
        pdfPage: pdfPage,
      });

      toast.info(`AI 오프셋 제안: +${offset} (${sample.title}: 책 p.${sample.page} → PDF p.${pdfPage})`);
    } catch (err: any) {
      console.error("Offset analysis error:", err);
      toast.warning("오프셋 자동 분석 실패. 수동으로 조정해주세요.");
    } finally {
      setAnalyzingOffset(false);
    }
  }, [callLLM]);

  const handleApplyOffset = useCallback((offset: number) => {
    setGlobalOffset(offset);
    setOffsetSuggestion(null);
    toast.success(`전역 오프셋 +${offset} 적용 완료! 이제 물리 페이지 = 목차 번호 + ${offset}`);
  }, []);

  const handleLlmDetect = useCallback(async () => {
    if (!pdfBytes) {
      toast.error("PDF 파일이 없습니다.");
      return;
    }
    setParsing(true);
    setShowLlmModal(false);
    setOffsetSuggestion(null);
    toast.info(`PDF ${tocStartPage}~${tocEndPage} 페이지 텍스트 추출 중...`);

    try {
      let text = await extractTextFromPdf(pdfBytes.slice().buffer, tocEndPage, tocStartPage);
      text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
      setExtractedText(text);
      toast.info(`${(text.length / 1000).toFixed(1)}KB 텍스트 전송 중... (${provider === "gemini" ? "Gemini" : "Ollama"})`);

      const prompt = `다음 텍스트는 책의 앞부분 내용입니다. 이 안에서 목차(Table of Contents)와 각 항목에 해당하는 '문서에 적힌 실제 논리 페이지 번호'를 추출해 주세요.
반드시 아래 JSON 배열 형식으로만 응답해야 합니다. 다른 말이나 마크다운 백틱 문법 등은 넣지 마세요.
[
  { "title": "항목 제목", "page": 페이지숫자, "level": 트리 레벨(1, 2, 3...) }
]

텍스트:
${text}`;

      const rawResponse = await callLLM(prompt);
      let detected: TocEntry[] = [];
      let cleanResponse = rawResponse.trim();
      cleanResponse = cleanResponse.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
      cleanResponse = cleanResponse.replace(/\s*```$/i, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleanResponse);
      } catch (firstErr) {
        console.warn("Strict JSON parse failed, attempting resilient parsing...", firstErr);
        try {
          parsed = JSON.parse(cleanResponse.replace(/,\s*([\]}])/g, '$1'));
        } catch (secondErr) {
          try {
            parsed = (new Function('return ' + cleanResponse))();
          } catch (thirdErr) {
            try {
              const lastBraceIndex = cleanResponse.lastIndexOf('}');
              if (lastBraceIndex > 0) {
                let rescued = cleanResponse.substring(0, lastBraceIndex + 1);
                const startBracket = rescued.indexOf('[');
                if (startBracket >= 0) {
                  rescued = rescued.substring(startBracket) + ']';
                  parsed = JSON.parse(rescued);
                } else {
                  throw new Error("No array start found");
                }
              } else {
                throw new Error("No closing brace found");
              }
            } catch (fourthErr) {
              const arrayMatch = cleanResponse.match(/\[[\s\S]*\]/);
              if (arrayMatch) {
                try {
                  parsed = (new Function('return ' + arrayMatch[0]))();
                } catch (fifthErr) {
                  throw new Error(`AI 응답 형식 오류 (배열 파싱 실패). 상세 에러는 콘솔을 확인하세요.`);
                }
              } else {
                throw new Error(`AI 응답 형식 오류 (JSON 파싱 실패).`);
              }
            }
          }
        }
      }

      if (Array.isArray(parsed)) {
        detected = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const arr = parsed.toc || parsed.entries || parsed.table_of_contents || parsed.items || parsed.data || parsed.tableOfContents;
        if (Array.isArray(arr)) {
          detected = arr;
        } else {
          const keys = Object.keys(parsed);
          const firstArrayKey = keys.find(k => Array.isArray(parsed[k]));
          if (firstArrayKey) {
             detected = parsed[firstArrayKey];
          } else {
             detected = [parsed];
          }
        }
      }

      detected = detected.map((entry: any) => ({
        title: String(entry.title || ""),
        page: Number(entry.page || 0),
        level: Number(entry.level || 1),
      }));

      if (detected.length === 0) {
        toast.info("LLM이 목차를 감지하지 못했습니다.");
      } else {
        setEntries(detected);
        toast.success(`${detected.length}개의 목차 항목을 감지했습니다! 오프셋 분석을 시작합니다...`);
        analyzeOffset(detected, text);
      }
    } catch (err: any) {
      console.error("전체 오류:", err);
      let msg = err.message || "알 수 없는 오류";
      if (provider === "ollama" && (msg.includes("fetch") || msg.includes("Failed") || msg.includes("NetworkError"))) {
        msg = `Ollama 서버 연결 실패!\nURL: ${llmUrl}\nOllama가 실행 중인지 확인해주세요.`;
      }
      toast.error(msg, { duration: 10000 });
    } finally {
      setParsing(false);
    }
  }, [pdfBytes, llmUrl, callLLM, analyzeOffset, tocStartPage, tocEndPage, provider]);

  const handleGenerate = useCallback(async () => {
    if (!pdfBytes) return;
    if (entries.length === 0 && !coverImage && globalOffset === 0) {
      toast.error("목차 항목, 표지 이미지, 또는 페이지 오프셋 중 하나 이상 설정해주세요.");
      return;
    }
    setGenerating(true);
    try {
      // addTocToPdf writes both Outlines (bookmarks) and /PageLabels when offset != 0
      const pdfBuffer = await addTocToPdf(pdfBytes.slice().buffer, entries, [globalOffset], coverImage);

      const blob = new Blob([pdfBuffer.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = entries.length > 0
        ? "_목차.pdf"
        : globalOffset !== 0 ? "_라벨.pdf" : "_목차.pdf";
      a.href = url;
      a.download = file?.name?.replace(".pdf", suffix) || "output.pdf";
      a.click();
      URL.revokeObjectURL(url);

      const parts: string[] = [];
      if (entries.length > 0) parts.push("북마크");
      if (globalOffset !== 0) parts.push("페이지 라벨");
      if (coverImage) parts.push("표지");
      toast.success(`PDF 생성 완료! (${parts.join(" + ") || "저장"})`);
    } catch (err: any) {
      console.error(err);
      toast.error("PDF 생성 오류: " + (err.message || ""));
    } finally {
      setGenerating(false);
    }
  }, [pdfBytes, entries, file, coverImage, globalOffset]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    borderRadius: 6,
    border: "1px solid var(--color-input)",
    backgroundColor: "var(--color-background)",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    color: "var(--color-foreground)",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-background)" }}>
      <Toaster richColors />

      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-card)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FileText style={{ width: 24, height: 24, color: "var(--color-primary)" }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>PDF 목차 생성기</h1>
              <p style={{ fontSize: 12, color: "var(--color-muted-foreground)", margin: 0 }}>Ollama 로컬 LLM 연동 · 목차 + 페이지 라벨 삽입</p>
            </div>
          </div>
          {pdfBytes && (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                onClick={() => { setShowLlmModal(true); }}
                disabled={parsing}
                style={{ backgroundColor: "#7c3aed", color: "#fff", fontSize: 13 }}
                size="sm"
              >
                {parsing ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Wand2 style={{ width: 14, height: 14 }} />}
                {parsing ? "감지 중..." : "AI 목차 감지"}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || (entries.length === 0 && !coverImage && globalOffset === 0)}
                variant="outline"
                size="sm"
                style={{ fontSize: 13 }}
              >
                {generating ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 14, height: 14 }} />}
                PDF 생성 & 저장
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px" }}>
        {!pdfBytes ? (
          <div style={{ maxWidth: 560, margin: "80px auto" }}>
            <PdfDropZone onFileSelect={handleFileSelect} currentFile={file} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "calc(100vh - 5.5rem)" }}>
            {/* Left: TocEditor + controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              {/* Compact file info bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-card)",
                fontSize: 13,
                flexShrink: 0,
              }}>
                <FileText style={{ width: 14, height: 14, color: "var(--color-primary)", flexShrink: 0 }} />
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{file?.name}</span>
                <span style={{ color: "var(--color-muted-foreground)", flexShrink: 0 }}>{totalPages}페이지</span>
                <button
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "application/pdf";
                    input.onchange = (ev) => {
                      const files = (ev.target as HTMLInputElement).files;
                      if (files && files[0]) handleFileSelect(files[0]);
                    };
                    input.click();
                  }}
                  style={{
                    fontSize: 11,
                    color: "var(--color-primary)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    flexShrink: 0,
                  }}
                >
                  변경
                </button>
              </div>

              {/* AI Offset Suggestion */}
              <OffsetSuggestion
                suggestion={offsetSuggestion}
                analyzing={analyzingOffset}
                onApply={handleApplyOffset}
                onDismiss={() => setOffsetSuggestion(null)}
              />

              {/* TocEditor takes remaining space */}
              <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid var(--color-border)" }}>
                <TocEditor
                  entries={entries}
                  onChange={setEntries}
                  totalPages={totalPages}
                  onEntryClick={setPreviewPage}
                  fileName={file?.name}
                  globalOffset={globalOffset}
                  onOffsetChange={setGlobalOffset}
                  hasExistingToc={hasExistingToc > 0}
                  existingTocCount={hasExistingToc}
                />
              </div>
            </div>

            {/* Right: Preview */}
            <div style={{
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-card)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}>
              <PdfPreview
                pdfBytes={pdfBytes}
                totalPages={totalPages}
                currentPage={previewPage}
                onPageChange={setPreviewPage}
              />
            </div>
          </div>
        )}
      </div>

      {/* LLM Settings Modal */}
      {showLlmModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 16,
        }}>
          <div style={{
            backgroundColor: "var(--color-card)",
            width: "100%",
            maxWidth: 440,
            padding: 24,
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>AI 목차 감지 설정</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Provider selector */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>AI 제공자</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProvider("gemini")}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 6,
                      border: `1px solid ${provider === "gemini" ? "#7c3aed" : "var(--color-input)"}`,
                      backgroundColor: provider === "gemini" ? "#7c3aed" : "var(--color-background)",
                      color: provider === "gemini" ? "#fff" : "var(--color-foreground)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >Gemini (클라우드)</button>
                  <button
                    type="button"
                    onClick={() => setProvider("ollama")}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 6,
                      border: `1px solid ${provider === "ollama" ? "#7c3aed" : "var(--color-input)"}`,
                      backgroundColor: provider === "ollama" ? "#7c3aed" : "var(--color-background)",
                      color: provider === "ollama" ? "#fff" : "var(--color-foreground)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >Ollama (로컬)</button>
                </div>
              </div>

              {/* Page range */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>목차 페이지 범위 (PDF 쪽수)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    value={tocStartPage}
                    onChange={e => setTocStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                    min={1}
                  />
                  <span style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>~</span>
                  <input
                    type="number"
                    value={tocEndPage}
                    onChange={e => setTocEndPage(parseInt(e.target.value) || 10)}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                    min={1}
                  />
                  <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>페이지</span>
                </div>
                <p style={{ fontSize: 11, color: "#7c3aed", marginTop: 4 }}>
                  💡 목차가 있는 페이지만 지정하면 훨씬 빠릅니다
                </p>
              </div>

              {provider === "ollama" ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Ollama API URL</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="text" value={llmUrl} onChange={e => setLlmUrl(e.target.value)} style={inputStyle} />
                      <Button size="sm" variant="outline" onClick={fetchOllamaModels} disabled={ollamaLoading} style={{ fontSize: 12, height: 40, whiteSpace: "nowrap" }}>
                        {ollamaLoading ? "조회 중..." : "새로고침"}
                      </Button>
                    </div>
                    {ollamaError && (
                      <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{ollamaError}</p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                      사용 모델 {ollamaModels.length > 0 && <span style={{ color: "var(--color-muted-foreground)", fontWeight: 400 }}>({ollamaModels.length}개 설치됨)</span>}
                    </label>
                    {ollamaModels.length > 0 ? (
                      <select value={llmModel} onChange={e => setLlmModel(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
                        {ollamaModels.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={llmModel} onChange={e => setLlmModel(e.target.value)} style={inputStyle} placeholder="예: gemma3:27b (Ollama 서버 미연결 시 직접 입력)" />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Gemini API Key</label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={e => setGeminiKey(e.target.value)}
                      style={inputStyle}
                      placeholder="AIza..."
                    />
                    <p style={{ fontSize: 11, color: "var(--color-muted-foreground)", marginTop: 4 }}>
                      .env의 VITE_GEMINI_API_KEY가 자동 로드됩니다.
                    </p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Gemini 모델</label>
                    <input type="text" value={geminiModel} onChange={e => setGeminiModel(e.target.value)} style={inputStyle} placeholder="예: gemini-2.5-flash" />
                  </div>
                </>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted-foreground)", marginTop: 8 }}>
              목차 감지 후 AI가 페이지 오프셋도 자동으로 분석하여 제안합니다.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <Button variant="ghost" onClick={() => setShowLlmModal(false)}>취소</Button>
              <Button onClick={handleLlmDetect} disabled={parsing}>
                {parsing ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : "감지 시작"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
