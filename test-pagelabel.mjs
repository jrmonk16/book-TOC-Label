import { PDFDocument, PDFName, PDFNumber, PDFDict, PDFArray } from 'pdf-lib';
import fs from 'fs';

async function run() {
  const doc = await PDFDocument.create();
  for(let i=0; i<10; i++) doc.addPage();
  
  const ctx = doc.context;
  const numsArray = PDFArray.withContext(ctx);
  
  numsArray.push(PDFNumber.of(0));
  const romanDict = PDFDict.withContext(ctx);
  romanDict.set(PDFName.of('S'), PDFName.of('r'));
  numsArray.push(romanDict);
  
  numsArray.push(PDFNumber.of(4));
  const arabicDict = PDFDict.withContext(ctx);
  arabicDict.set(PDFName.of('S'), PDFName.of('D'));
  arabicDict.set(PDFName.of('St'), PDFNumber.of(1));
  numsArray.push(arabicDict);

  const dict = PDFDict.withContext(ctx);
  dict.set(PDFName.of('Nums'), numsArray);
  const ref = ctx.register(dict);
  doc.catalog.set(PDFName.of('PageLabels'), ref);
  
  fs.writeFileSync('label-test.pdf', await doc.save());
  console.log('done');
}
run();
