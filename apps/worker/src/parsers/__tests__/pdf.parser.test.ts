import { describe, expect, it } from 'vitest';

import { PermanentError } from '../../lib/retry.js';
import { pdfParser } from '../pdf.parser.js';

import { makeEmptyPdf, makeMultiPagePdf, makeTextPdf } from './fixtures.js';

describe('pdfParser', () => {
  it('supports application/pdf and .pdf extension', () => {
    expect(pdfParser.supports('application/pdf', 'cv.pdf')).toBe(true);
    expect(pdfParser.supports('application/octet-stream', 'cv.PDF')).toBe(true);
    expect(pdfParser.supports('text/plain', 'cv.txt')).toBe(false);
  });

  it('extracts text and pageCount from a text-based PDF', async () => {
    const buf = await makeTextPdf('Hello world from CV');
    const result = await pdfParser.parse(buf, 'cv.pdf');
    expect(result.text).toContain('Hello world');
    expect(result.metadata['pageCount']).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('returns warning when no extractable text (scan-like PDF)', async () => {
    const buf = await makeEmptyPdf();
    const result = await pdfParser.parse(buf, 'scan.pdf');
    expect(result.text).toBe('');
    expect(result.warnings).toEqual(['no extractable text, may need OCR']);
  });

  it('handles multi-page PDFs', async () => {
    const buf = await makeMultiPagePdf(['Page one text', 'Page two text', 'Page three text']);
    const result = await pdfParser.parse(buf, 'multi.pdf');
    expect(result.metadata['pageCount']).toBe(3);
    expect(result.text).toMatch(/Page one/);
    expect(result.text).toMatch(/Page three/);
  });

  it('throws PermanentError on corrupt PDF input', async () => {
    const garbage = Buffer.from('not-a-pdf');
    await expect(pdfParser.parse(garbage, 'broken.pdf')).rejects.toBeInstanceOf(PermanentError);
  });
});
