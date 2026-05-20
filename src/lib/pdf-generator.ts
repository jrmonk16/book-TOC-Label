import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString, PDFNumber, PDFRawStream } from 'pdf-lib';
import { type TocEntry } from './pdf-utils';

/**
 * Adds PDF/A-2B identification markers to the document.
 *
 * Limitations:
 *  - This adds XMP metadata (pdfaid:part=2, conformance=B) and an OutputIntent.
 *  - It does NOT embed an sRGB ICC profile (would require ~3KB bundled binary),
 *    so strict validators (veraPDF) will reject it.
 *  - Most PDF viewers (Adobe, Preview, Foxit) will however identify and display
 *    the file as PDF/A.
 *  - Source PDFs containing transparency, encryption, or unembedded fonts
 *    cannot be made into truly compliant PDF/A by metadata alone.
 */
function applyPdfAMarkers(pdfDoc: PDFDocument) {
  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;
  const now = new Date();

  pdfDoc.setProducer('PDF TOC LLM');
  pdfDoc.setCreator('PDF TOC LLM');
  if (!pdfDoc.getCreationDate()) pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);

  const isoDate = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const title = pdfDoc.getTitle() || '';
  const escapeXml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="PDF TOC LLM">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
   <pdf:Producer>PDF TOC LLM</pdf:Producer>
   <xmp:CreatorTool>PDF TOC LLM</xmp:CreatorTool>
   <xmp:CreateDate>${isoDate}</xmp:CreateDate>
   <xmp:ModifyDate>${isoDate}</xmp:ModifyDate>
   <pdfaid:part>2</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const xmpBytes = new TextEncoder().encode(xmp);
  const metadataDict = context.obj({
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
    Length: PDFNumber.of(xmpBytes.length),
  }) as PDFDict;
  const metadataStream = PDFRawStream.of(metadataDict, xmpBytes);
  const metadataRef = context.register(metadataStream);
  catalog.set(PDFName.of('Metadata'), metadataRef);

  // Minimal OutputIntent (no embedded ICC profile).
  const outputIntent = context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
  });
  catalog.set(PDFName.of('OutputIntents'), context.obj([outputIntent]));

  // PDF/A forbids the /MarkInfo absence when structured; leave as-is for scans.
}

/**
 * Writes a /PageLabels dictionary to the PDF catalog.
 *
 * offset > 0: physical 0..offset-1 are roman (i, ii, iii...), physical offset onwards are arabic from 1.
 * offset < 0: arabic numbers starting from (1 - offset) — PDF begins in the middle of the book.
 * offset = 0: arabic numbers from 1.
 */
function setPageLabels(pdfDoc: PDFDocument, offset: number) {
  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;
  const totalPages = pdfDoc.getPageCount();

  const nums: any[] = [];

  if (offset > 0) {
    const frontEnd = Math.min(offset, totalPages);
    nums.push(PDFNumber.of(0));
    nums.push(context.obj({ S: PDFName.of('r'), St: PDFNumber.of(1) }));
    if (frontEnd < totalPages) {
      nums.push(PDFNumber.of(frontEnd));
      nums.push(context.obj({ S: PDFName.of('D'), St: PDFNumber.of(1) }));
    }
  } else if (offset < 0) {
    nums.push(PDFNumber.of(0));
    nums.push(context.obj({ S: PDFName.of('D'), St: PDFNumber.of(1 - offset) }));
  } else {
    nums.push(PDFNumber.of(0));
    nums.push(context.obj({ S: PDFName.of('D'), St: PDFNumber.of(1) }));
  }

  const pageLabelsDict = context.obj({
    Nums: context.obj(nums),
  });

  catalog.set(PDFName.of('PageLabels'), pageLabelsDict);
}

export async function addTocToPdf(
  buffer: ArrayBuffer,
  entries: TocEntry[],
  pageOffsets: number[] = [0],
  coverImage?: string | null,
  pdfA: boolean = false
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(buffer);
  
  // 1. Add Cover Image if provided (as the absolute first page)
  if (coverImage) {
    try {
      const res = await fetch(coverImage);
      const imgBuffer = await res.arrayBuffer();
      let pdfImage;
      if (coverImage.match(/\.(png)/i) || res.headers.get('content-type')?.includes('png')) {
        pdfImage = await pdfDoc.embedPng(imgBuffer);
      } else {
        pdfImage = await pdfDoc.embedJpg(imgBuffer);
      }
      const page = pdfDoc.insertPage(0, [pdfImage.width, pdfImage.height]);
      page.drawImage(pdfImage, {
        x: 0,
        y: 0,
        width: pdfImage.width,
        height: pdfImage.height,
      });
      // Adjust all entries since we added a cover page
      entries.forEach(e => e.page += 1);
    } catch (e) {
      console.error("Cover image insertion failed:", e);
    }
  }

  // Helper to encode strings as UTF-16BE hex for multi-language Outline support (Korean)
  function toUTF16BEHex(str: string): PDFHexString {
    let hex = 'FEFF'; // Byte Order Mark
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i).toString(16).toUpperCase();
      while (charCode.length < 4) charCode = '0' + charCode;
      hex += charCode;
    }
    return PDFHexString.of(hex);
  }

  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;

  const globalOffset = pageOffsets[0] || 0;
  if (globalOffset !== 0) {
    setPageLabels(pdfDoc, globalOffset);
  }

  // 3. Build the TOC (Outlines)
  if (entries.length > 0) {
    const outlinesDictRef = context.nextRef();
    const outlineItems: { ref: PDFRef; dict: Map<string, any>; level: number; parent?: PDFRef }[] = [];

    // Create raw outline item dictionaries
    for (const entry of entries) {
      // physical page index = logical page + global offset - 1
      const targetPageIndex = (entry.page + globalOffset) - 1;
      const validPageIndex = Math.max(0, Math.min(targetPageIndex, pdfDoc.getPageCount() - 1));

      const destArray = context.obj([
        pdfDoc.getPage(validPageIndex).ref,
        PDFName.of('XYZ'),
        null,
        null,
        null
      ]);

      const itemDict = new Map<string, any>();
      // Use UTF-16BE so Korean characters display correctly
      itemDict.set('Title', toUTF16BEHex(entry.title));
      itemDict.set('Dest', destArray);
      
      outlineItems.push({
        ref: context.nextRef(),
        dict: itemDict,
        level: entry.level,
      });
    }

    // Link parents, next, prev, first, last
    let firstOutlineRef: PDFRef | undefined;
    let lastOutlineRef: PDFRef | undefined;

    const stack: { node: any, children: any[] }[] = [{ node: { ref: outlinesDictRef }, children: [] }];

    for (let i = 0; i < outlineItems.length; i++) {
      const item = outlineItems[i];
      let level = item.level;

      // Adjust stack for current level
      while (stack.length > level) stack.pop();
      while (stack.length < level) {
        // Dummy intermediate nodes if skipped levels
        stack.push({ node: stack[stack.length - 1].children[stack[stack.length - 1].children.length - 1] || stack[stack.length - 1].node, children: [] });
      }

      const parent = stack[stack.length - 1];
      parent.children.push(item);
      item.parent = parent.node.ref;
      item.dict.set('Parent', parent.node.ref);

      if (level === 1) {
        if (!firstOutlineRef) firstOutlineRef = item.ref;
        lastOutlineRef = item.ref;
      }
    }

    // Process linked lists horizontally and vertical counts
    const processChildren = (nodeItem: any, children: any[]) => {
      if (children.length === 0) return 0;
      
      let count = children.length;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (i > 0) child.dict.set('Prev', children[i - 1].ref);
        if (i < children.length - 1) child.dict.set('Next', children[i + 1].ref);
        
        // Find children of this child
        const childsChildren = stack.find(s => s.node === child)?.children || [];
        const descendents = processChildren(child, childsChildren);
        count += descendents;
      }
      
      nodeItem.dict?.set('First', children[0].ref);
      nodeItem.dict?.set('Last', children[children.length - 1].ref);
      nodeItem.dict?.set('Count', context.obj(count)); // Positive count = opened by default
      return count;
    };

    const totalCount = processChildren({ dict: new Map() }, stack[0].children);

    for (const item of outlineItems) {
      const dictObj = context.obj(Object.fromEntries(item.dict));
      context.assign(item.ref, dictObj);
    }

    const outlinesDict = context.obj({
      Type: PDFName.of('Outlines'),
      First: firstOutlineRef,
      Last: lastOutlineRef,
      Count: context.obj(totalCount)
    });
    
    context.assign(outlinesDictRef, outlinesDict);
    catalog.set(PDFName.of('Outlines'), outlinesDictRef);
  }
  
  if (pdfA) {
    applyPdfAMarkers(pdfDoc);
  }

  return await pdfDoc.save();
}
