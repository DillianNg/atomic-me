import { describe, expect, it } from 'vitest';

import {
  AtomContentSchema,
  AtomCreateInputSchema,
  AtomKindSchema,
  AtomSchema,
  EvidenceSpanSchema,
} from '../atom';

describe('AtomKindSchema', () => {
  it('accepts a valid kind', () => {
    expect(AtomKindSchema.parse('SKILL')).toBe('SKILL');
  });

  it('accepts all enum members', () => {
    for (const kind of [
      'SKILL',
      'EXPERIENCE',
      'EDUCATION',
      'ACHIEVEMENT',
      'PROJECT',
      'CERTIFICATION',
      'LANGUAGE',
      'RESPONSIBILITY',
    ]) {
      expect(AtomKindSchema.parse(kind)).toBe(kind);
    }
  });

  it('rejects an unknown kind', () => {
    expect(() => AtomKindSchema.parse('UNKNOWN')).toThrow();
  });

  it('rejects a lowercased kind', () => {
    expect(() => AtomKindSchema.parse('skill')).toThrow();
  });
});

describe('EvidenceSpanSchema', () => {
  it('parses a valid span', () => {
    const span = { assetId: 'a1', startOffset: 0, endOffset: 42, snippet: 'hello' };
    expect(EvidenceSpanSchema.parse(span)).toEqual(span);
  });

  it('rejects negative offsets', () => {
    expect(() =>
      EvidenceSpanSchema.parse({ assetId: 'a1', startOffset: -1, endOffset: 5, snippet: 'x' }),
    ).toThrow();
  });

  it('rejects non-integer offsets', () => {
    expect(() =>
      EvidenceSpanSchema.parse({ assetId: 'a1', startOffset: 1.5, endOffset: 5, snippet: 'x' }),
    ).toThrow();
  });

  it('rejects a missing snippet', () => {
    expect(() =>
      EvidenceSpanSchema.parse({ assetId: 'a1', startOffset: 0, endOffset: 5 }),
    ).toThrow();
  });
});

describe('AtomContentSchema (discriminated union)', () => {
  it('parses SKILL content', () => {
    const content = { kind: 'SKILL', name: 'TypeScript', level: 'ADVANCED' };
    expect(AtomContentSchema.parse(content)).toMatchObject(content);
  });

  it('parses EXPERIENCE content with endDate "present"', () => {
    const content = {
      kind: 'EXPERIENCE',
      company: 'Acme',
      title: 'Engineer',
      startDate: '2022-01-01',
      endDate: 'present',
      description: 'Built things',
    };
    expect(AtomContentSchema.parse(content)).toMatchObject(content);
  });

  it('rejects content with a mismatched discriminator shape', () => {
    // kind=SKILL nhung thieu `name` bat buoc
    expect(() => AtomContentSchema.parse({ kind: 'SKILL', level: 'EXPERT' })).toThrow();
  });

  it('rejects an unknown discriminator', () => {
    expect(() => AtomContentSchema.parse({ kind: 'NOPE', name: 'x' })).toThrow();
  });
});

describe('AtomCreateInputSchema', () => {
  const validInput = {
    userId: 'u1',
    assetId: 'asset1',
    kind: 'SKILL',
    content: { kind: 'SKILL', name: 'Go' },
    evidenceSpan: { assetId: 'asset1', startOffset: 0, endOffset: 2, snippet: 'Go' },
    confidence: 0.9,
  };

  it('parses a valid create input', () => {
    expect(AtomCreateInputSchema.parse(validInput)).toMatchObject(validInput);
  });

  it('accepts a null assetId (manual atom)', () => {
    expect(AtomCreateInputSchema.parse({ ...validInput, assetId: null })).toBeTruthy();
  });

  it('rejects confidence above 1', () => {
    expect(() => AtomCreateInputSchema.parse({ ...validInput, confidence: 1.5 })).toThrow();
  });

  it('rejects confidence below 0', () => {
    expect(() => AtomCreateInputSchema.parse({ ...validInput, confidence: -0.1 })).toThrow();
  });
});

describe('AtomSchema', () => {
  const validAtom = {
    id: 'atom1',
    userId: 'u1',
    assetId: 'asset1',
    kind: 'PROJECT',
    content: { kind: 'PROJECT', name: 'atomic-me', description: 'CV builder' },
    evidenceSpan: { assetId: 'asset1', startOffset: 0, endOffset: 9, snippet: 'atomic-me' },
    confidence: 0.75,
    canonicalSkillId: null,
    isVerified: false,
    mergedIntoId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('parses a fully valid atom', () => {
    expect(AtomSchema.parse(validAtom)).toBeTruthy();
  });

  it('rejects when createdAt is not a Date', () => {
    expect(() => AtomSchema.parse({ ...validAtom, createdAt: '2026-01-01' })).toThrow();
  });

  it('rejects when confidence is missing', () => {
    const { confidence: _omit, ...rest } = validAtom;
    expect(() => AtomSchema.parse(rest)).toThrow();
  });
});
