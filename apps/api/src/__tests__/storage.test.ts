import { describe, expect, it } from 'vitest';

import { buildStorageKey, sanitizeFilename } from '../plugins/storage.js';

describe('sanitizeFilename', () => {
  it('keeps safe characters intact', () => {
    expect(sanitizeFilename('resume_v2.pdf')).toBe('resume_v2.pdf');
  });

  it('replaces whitespace and parentheses with underscore', () => {
    expect(sanitizeFilename('my resume (final).pdf')).toBe('my_resume_final_.pdf');
  });

  it('collapses runs of underscores', () => {
    expect(sanitizeFilename('a   b___c.pdf')).toBe('a_b_c.pdf');
  });

  it('strips leading dots/underscores', () => {
    expect(sanitizeFilename('...secret.pdf')).toBe('secret.pdf');
  });

  it('falls back to "unnamed" when all chars are stripped', () => {
    expect(sanitizeFilename('???')).toBe('unnamed');
  });

  it('crops to <= 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });
});

describe('buildStorageKey', () => {
  it('formats users/{userId}/assets/{assetId}/{sanitizedFilename}', () => {
    expect(buildStorageKey('u1', 'a1', 'CV final.pdf')).toBe('users/u1/assets/a1/CV_final.pdf');
  });

  it('sanitizes the filename portion only', () => {
    const key = buildStorageKey('user_x', 'asset_y', 'a b/c.pdf');
    expect(key.startsWith('users/user_x/assets/asset_y/')).toBe(true);
    expect(key).toBe('users/user_x/assets/asset_y/a_b_c.pdf');
  });
});
