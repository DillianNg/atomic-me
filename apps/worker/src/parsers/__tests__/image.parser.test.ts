import { describe, expect, it } from 'vitest';

import { PermanentError } from '../../lib/retry.js';
import { audioParser } from '../audio.parser.js';
import { imageParser } from '../image.parser.js';

import { makeJpeg, makePng } from './fixtures.js';

describe('imageParser', () => {
  it('supports image mimes + extensions', () => {
    expect(imageParser.supports('image/png', 'a.png')).toBe(true);
    expect(imageParser.supports('image/jpeg', 'a.jpg')).toBe(true);
    expect(imageParser.supports('image/webp', 'a.webp')).toBe(true);
    expect(imageParser.supports('application/pdf', 'cv.pdf')).toBe(false);
  });

  it('returns empty text + width/height for PNG', async () => {
    const buf = await makePng(40, 25);
    const result = await imageParser.parse(buf, 'photo.png');
    expect(result.text).toBe('');
    expect(result.metadata['width']).toBe(40);
    expect(result.metadata['height']).toBe(25);
    expect(result.metadata['format']).toBe('png');
    expect(result.metadata['sizeBytes']).toBe(buf.length);
    expect(result.warnings).toEqual(['image parsing deferred to extraction phase']);
  });

  it('parses JPEG metadata', async () => {
    const buf = await makeJpeg(60, 60);
    const result = await imageParser.parse(buf, 'photo.jpg');
    expect(result.metadata['format']).toBe('jpeg');
    expect(result.text).toBe('');
  });

  it('throws PermanentError on invalid image bytes', async () => {
    const garbage = Buffer.from('not-an-image');
    await expect(imageParser.parse(garbage, 'broken.png')).rejects.toBeInstanceOf(PermanentError);
  });
});

describe('audioParser', () => {
  it('supports common audio mimes + extensions', () => {
    expect(audioParser.supports('audio/mpeg', 'voice.mp3')).toBe(true);
    expect(audioParser.supports('audio/wav', 'voice.wav')).toBe(true);
    expect(audioParser.supports('application/octet-stream', 'voice.m4a')).toBe(true);
  });

  it('always throws PermanentError (not supported yet)', async () => {
    await expect(audioParser.parse(Buffer.from('anything'), 'voice.mp3')).rejects.toBeInstanceOf(
      PermanentError,
    );
  });
});
