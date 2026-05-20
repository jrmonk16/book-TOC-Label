/**
 * Real PDF/A-2B conversion via Ghostscript.
 *
 * Unlike the metadata-only path in pdf-generator.ts, Ghostscript actually
 * rewrites the document — re-embeds fonts, normalizes ToUnicode CMaps,
 * fixes color space, and produces an ISO 19005-conformant file.
 *
 * This is required for Kindle Korean OCR text extraction, because Kindle
 * only reads text layers with proper Unicode mappings.
 *
 * Works only inside Electron (uses Node child_process).
 */

const GS_CANDIDATES = [
  '/opt/homebrew/bin/gs',  // Apple Silicon Homebrew
  '/usr/local/bin/gs',     // Intel Homebrew
  '/usr/bin/gs',
  '/opt/local/bin/gs',     // MacPorts
];

function getNode(): any | null {
  if (typeof window === 'undefined') return null;
  const req = (window as any).require;
  if (typeof req !== 'function') return null;
  return req;
}

export function findGhostscript(): string | null {
  const req = getNode();
  if (!req) return null;
  const fs = req('fs');
  for (const p of GS_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  try {
    const { execSync } = req('child_process');
    const out = execSync('command -v gs', {
      encoding: 'utf-8',
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` },
    }).trim();
    if (out.startsWith('/')) return out;
  } catch {}
  return null;
}

export function isElectron(): boolean {
  return getNode() !== null;
}

export async function convertToPdfAWithGhostscript(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const req = getNode();
  if (!req) throw new Error('Electron 환경에서만 동작합니다.');

  const gsPath = findGhostscript();
  if (!gsPath) throw new Error('Ghostscript를 찾을 수 없습니다. brew install ghostscript');

  const { execFileSync } = req('child_process');
  const fs = req('fs');
  const path = req('path');
  const os = req('os');

  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const tmpIn = path.join(tmpDir, `pdfa_in_${ts}.pdf`);
  const tmpOut = path.join(tmpDir, `pdfa_out_${ts}.pdf`);

  fs.writeFileSync(tmpIn, Buffer.from(pdfBytes));

  try {
    execFileSync(gsPath, [
      '-dPDFA=2',
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      '-dPDFACompatibilityPolicy=1',  // best-effort: drop/modify non-conformant features
      '-sColorConversionStrategy=RGB',
      '-sDEVICE=pdfwrite',
      `-sOutputFile=${tmpOut}`,
      tmpIn,
    ], { timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });

    const out = fs.readFileSync(tmpOut);
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}
