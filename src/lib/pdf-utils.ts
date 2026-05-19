import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface TocEntry {
  title: string;
  page: number;
  level: number;
}

export async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  return doc.numPages;
}

export async function extractExistingToc(buffer: ArrayBuffer): Promise<TocEntry[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const outline = await doc.getOutline();
  if (!outline || outline.length === 0) return [];

  const entries: TocEntry[] = [];
  
  async function traverse(items: any[], level: number) {
    if (!items) return;
    for (const item of items) {
      let physicalPage = 0;
      if (item.dest) {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await doc.getDestination(dest);
        }
        if (Array.isArray(dest)) {
          try {
            // getPageIndex throws if ref is not found
            const pageIndex = await doc.getPageIndex(dest[0]);
            physicalPage = pageIndex + 1; // 1-based physical page
          } catch (e) {
            console.warn("Failed to get page index for dest:", dest);
          }
        }
      }
      
      // We store the physical page as the 'logical' page initially. 
      // If the user applies an offset later, it will shift this base page.
      entries.push({
        title: item.title,
        page: physicalPage,
        level: level
      });
      
      if (item.items && item.items.length > 0) {
        await traverse(item.items, level + 1);
      }
    }
  }

  await traverse(outline, 1);
  return entries;
}

export async function extractTextFromPdf(buffer: ArrayBuffer, maxPages = 30, startPage = 1): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  const from = Math.max(1, startPage);
  const to = Math.min(doc.numPages, maxPages);

  for (let i = from; i <= to; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  return text;
}

/**
 * Smart TOC extraction: reads pages one by one, detects TOC-like pages,
 * and stops once it finds 2 consecutive non-TOC pages after seeing TOC content.
 * This dramatically reduces the text sent to the LLM.
 */
export async function extractTocTextSmart(buffer: ArrayBuffer): Promise<{ text: string; tocPageRange: string }> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const maxScan = Math.min(doc.numPages, 30); // Safety cap

  let text = '';
  let tocStarted = false;
  let consecutiveNonToc = 0;
  let firstTocPage = 0;
  let lastTocPage = 0;
  let pagesIncluded = 0;

  for (let i = 1; i <= maxScan; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    
    const isTocLike = isTocPage(pageText, i);
    
    if (isTocLike) {
      tocStarted = true;
      consecutiveNonToc = 0;
      lastTocPage = i;
      if (!firstTocPage) firstTocPage = i;
    } else if (tocStarted) {
      consecutiveNonToc++;
    }

    // Always include: pages before TOC starts (front matter), TOC pages themselves,
    // and 1 page after TOC ends (for context)
    if (!tocStarted || isTocLike || consecutiveNonToc <= 1) {
      text += `--- Page ${i} ---\n${pageText}\n\n`;
      pagesIncluded++;
    }

    // Stop scanning if we've seen TOC and then 2+ consecutive non-TOC pages
    if (tocStarted && consecutiveNonToc >= 2) {
      break;
    }
  }

  // If no TOC was detected heuristically, fall back to first 8 pages
  if (!tocStarted) {
    text = '';
    const fallback = Math.min(doc.numPages, 8);
    for (let i = 1; i <= fallback; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return { text, tocPageRange: `1-${fallback} (자동감지 실패, fallback)` };
  }

  return {
    text,
    tocPageRange: `${firstTocPage}-${lastTocPage} (${pagesIncluded}페이지 전송)`,
  };
}

/**
 * Heuristic to detect if a page looks like a Table of Contents page.
 * Checks for:
 * - "목차", "차례", "contents" keywords
 * - Many lines ending with numbers (page references)
 * - Dot leaders (...... or ·····)
 * - High density of number patterns
 */
function isTocPage(pageText: string, pageNum: number): boolean {
  const text = pageText.toLowerCase();
  
  // Direct keyword match (strong signal)
  if (/목\s*차|차\s*례|table\s*of\s*contents|contents/i.test(text)) {
    return true;
  }

  // Split into rough "lines" (pdfjs joins items with spaces)
  // Look for patterns like "제1장 소개 15" or "Chapter 1 .... 15"
  const words = pageText.split(/\s+/);
  
  // Count trailing numbers (potential page references)
  // Pattern: word sequences ending in 1-4 digit numbers
  let pageRefCount = 0;
  const numberPattern = /^\d{1,4}$/;
  for (let i = 1; i < words.length; i++) {
    if (numberPattern.test(words[i]) && words[i - 1] && !numberPattern.test(words[i - 1])) {
      pageRefCount++;
    }
  }

  // Count dot leaders
  const dotLeaders = (pageText.match(/\.{3,}|·{3,}|…{2,}/g) || []).length;

  // Count Roman numerals mixed with text (common in TOC: "i", "ii", "iii", "iv", "v", "vi")
  const romanNumerals = (pageText.match(/\b[ivxlc]{1,6}\b/gi) || []).length;

  // TOC pages typically have many page references or dot leaders
  // A page with 3+ page references or 2+ dot leaders is likely TOC
  if (pageRefCount >= 4) return true;
  if (dotLeaders >= 2) return true;
  if (pageRefCount >= 2 && dotLeaders >= 1) return true;

  // Short pages with several numbers (might be a simple TOC)
  if (words.length < 200 && pageRefCount >= 3) return true;

  return false;
}
