import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';

import { PermanentError } from '../../lib/retry.js';
import { linkedinArchiveParser } from '../linkedin-archive.parser.js';

import { makeLinkedinZip } from './fixtures.js';

describe('linkedinArchiveParser', () => {
  it('supports application/zip + .zip', () => {
    expect(linkedinArchiveParser.supports('application/zip', 'export.zip')).toBe(true);
    expect(linkedinArchiveParser.supports('application/zip', 'CV.pdf')).toBe(false);
  });

  it('concatenates sections with headings and tracks counts', async () => {
    const buf = makeLinkedinZip();
    const result = await linkedinArchiveParser.parse(buf, 'export.zip');

    expect(result.text).toContain('## Profile');
    expect(result.text).toContain('## Work experience');
    expect(result.text).toContain('## Education');
    expect(result.text).toContain('## Skills');
    expect(result.text).toContain('## Certifications');
    expect(result.text).toContain('## Projects');

    expect(result.text).toContain('Jane');
    expect(result.text).toContain('Acme');
    expect(result.text).toContain('Senior Engineer');
    expect(result.text).toContain('MIT');

    const counts = result.metadata['counts'] as Record<string, number>;
    expect(counts['Profile.csv']).toBe(1);
    expect(counts['Positions.csv']).toBe(2);
    expect(counts['Education.csv']).toBe(1);
    expect(counts['Skills.csv']).toBe(2);
    expect(counts['Certifications.csv']).toBe(1);
    expect(counts['Projects.csv']).toBe(1);
  });

  it('throws PermanentError if Profile.csv missing', async () => {
    const zip = new AdmZip();
    zip.addFile('Positions.csv', Buffer.from('Title\nDev\n'));
    await expect(linkedinArchiveParser.parse(zip.toBuffer(), 'bad.zip')).rejects.toBeInstanceOf(
      PermanentError,
    );
  });

  it('throws PermanentError on invalid zip', async () => {
    const garbage = Buffer.from('not-a-zip-file');
    await expect(linkedinArchiveParser.parse(garbage, 'broken.zip')).rejects.toBeInstanceOf(
      PermanentError,
    );
  });
});
