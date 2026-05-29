import { describe, expect, it } from 'vitest';

import { PermanentError } from '../../lib/retry.js';
import { parserRegistry } from '../index.js';

describe('parserRegistry', () => {
  it.each([
    ['application/pdf', 'cv.pdf', 'pdf'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'cv.docx',
      'docx',
    ],
    ['image/png', 'photo.png', 'image'],
    ['image/jpeg', 'photo.jpg', 'image'],
    ['audio/mpeg', 'voice.mp3', 'audio'],
    ['application/zip', 'Basic_LinkedInDataExport.zip', 'linkedin-archive'],
  ])('routes mime=%s filename=%s -> parser %s', (mime, filename, expectedName) => {
    const parser = parserRegistry.getParser(mime, filename);
    expect(parser.name).toBe(expectedName);
  });

  it('throws PermanentError on unsupported mime+filename', () => {
    expect(() => parserRegistry.getParser('application/x-msdownload', 'malware.exe')).toThrow(
      PermanentError,
    );
  });
});
