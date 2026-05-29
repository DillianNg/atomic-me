import { describe, expect, it } from 'vitest';

import { PermanentError } from '../../lib/retry.js';
import { docxParser } from '../docx.parser.js';

import { makeMinimalDocx } from './fixtures.js';

describe('docxParser', () => {
  it('supports OOXML mime + .docx extension', () => {
    expect(
      docxParser.supports(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'cv.docx',
      ),
    ).toBe(true);
    expect(docxParser.supports('application/octet-stream', 'cv.DOCX')).toBe(true);
    expect(docxParser.supports('application/pdf', 'cv.pdf')).toBe(false);
  });

  it('extracts raw text and strips formatting', async () => {
    const buf = makeMinimalDocx([
      'Jane Doe',
      'Senior Engineer at Acme Corp',
      'Built distributed systems in TypeScript.',
    ]);
    const result = await docxParser.parse(buf, 'cv.docx');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Senior Engineer at Acme Corp');
    expect(result.text).toContain('distributed systems');
    expect(result.warnings).toEqual([]);
  });

  it('returns an empty string when document has no paragraphs', async () => {
    const buf = makeMinimalDocx([]);
    const result = await docxParser.parse(buf, 'empty.docx');
    expect(result.text).toBe('');
  });

  it('throws PermanentError on corrupt DOCX input', async () => {
    const garbage = Buffer.from('definitely-not-a-docx');
    await expect(docxParser.parse(garbage, 'bad.docx')).rejects.toBeInstanceOf(PermanentError);
  });
});
