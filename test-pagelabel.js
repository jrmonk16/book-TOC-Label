const { PDFDocument, PDFName, PDFNumber, PDFDict } = require('pdf-lib');
const fs = require('fs');

async function run() {
  const doc = await PDFDocument.create();
  for(let i=0; i<10; i++) doc.addPage();
  
  const ctx = doc.context;
  const numsArray = [
    ctx.obj(0), ctx.obj({ S: PDFName.of('r') }),
    ctx.obj(4), ctx.obj({ S: PDFName.of('D'), St: ctx.obj(1) })
  ];
  const dict = ctx.obj({ Nums: ctx.obj(numsArray) });
  const ref = ctx.register(dict);
  doc.catalog.set(PDFName.of('PageLabels'), ref);
  
  fs.writeFileSync('label-test.pdf', await doc.save());
  console.log('done');
}
run();
