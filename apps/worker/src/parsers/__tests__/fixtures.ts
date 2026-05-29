/**
 * Generators tao file fixture trong bo nho (PDF, DOCX, zip, image).
 * Khong commit binary fixture: build at test time -> dependable + diff-able.
 */
import AdmZip from 'adm-zip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';

/** PDF text-based 1 trang, co text noi dung custom. */
export async function makeTextPdf(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle('Test CV');
  doc.setAuthor('Vitest Fixture');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  page.setFont(font);
  page.setFontSize(12);
  page.drawText(text, { x: 50, y: 720 });
  return Buffer.from(await doc.save());
}

/** PDF nhieu trang text-based. */
export async function makeMultiPagePdf(pages: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of pages) {
    const p = doc.addPage();
    p.setFont(font);
    p.setFontSize(12);
    p.drawText(t, { x: 50, y: 720 });
  }
  return Buffer.from(await doc.save());
}

/** PDF khong co text (scan-like): 1 trang trong, chi co image nho. */
export async function makeEmptyPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
  const embedded = await doc.embedPng(png);
  const page = doc.addPage();
  page.drawImage(embedded, { x: 0, y: 0, width: 10, height: 10 });
  return Buffer.from(await doc.save());
}

/**
 * Build mot DOCX toi thieu (zip cua OOXML XML files).
 * Cau truc: [Content_Types].xml + _rels/.rels + word/document.xml + word/_rels/document.xml.rels
 */
export function makeMinimalDocx(paragraphs: string[]): Buffer {
  const zip = new AdmZip();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}</w:body>
</w:document>`;

  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(document, 'utf-8'));
  return zip.toBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** LinkedIn export zip mau. */
export function makeLinkedinZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile('Profile.csv', Buffer.from('First Name,Last Name,Headline\nJane,Doe,Engineer\n'));
  zip.addFile(
    'Positions.csv',
    Buffer.from(
      'Company Name,Title,Started On,Finished On\nAcme,Senior Engineer,2020-01,2023-06\nGlobex,Tech Lead,2023-07,\n',
    ),
  );
  zip.addFile('Education.csv', Buffer.from('School Name,Degree Name\nMIT,BSc Computer Science\n'));
  zip.addFile('Skills.csv', Buffer.from('Name\nTypeScript\nDistributed systems\n'));
  zip.addFile('Certifications.csv', Buffer.from('Name,Authority\nAWS SA,Amazon\n'));
  zip.addFile('Projects.csv', Buffer.from('Title,Description\nAtomic me,AI career platform\n'));
  // File khong nam trong EXPECTED_FILES, parser phai ignore:
  zip.addFile('Connections.csv', Buffer.from('First Name,Last Name\nX,Y\n'));
  return zip.toBuffer();
}

/** Tao PNG nho. */
export function makePng(width = 20, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

/** Tao JPEG nho. */
export function makeJpeg(width = 20, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}
