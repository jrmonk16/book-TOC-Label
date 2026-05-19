import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import path from 'path';

async function testGeminiWithRealPdf() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (!match || !match[1]) return console.log("No API Key");
  const key = match[1].trim();

  // Load user PDF
  const pdfBytes = fs.readFileSync('../pdf_label/scan_raw.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  // We can't extract text with pdf-lib easily, wait! pdf-lib does not have text extraction!
  // App.tsx uses `extractTextFromPdf` which uses pdf.js!
}
testGeminiWithRealPdf();
