import AdmZip from 'adm-zip';

import { PermanentError } from '../lib/retry.js';

import type { FileParser, ParseResult } from './types.js';

const EXPECTED_FILES = [
  'Profile.csv',
  'Positions.csv',
  'Education.csv',
  'Skills.csv',
  'Certifications.csv',
  'Projects.csv',
] as const;

type ExpectedFile = (typeof EXPECTED_FILES)[number];

/** Parse 1 file CSV bang split don gian (LinkedIn export khong escape ngoac kep loi). */
function parseCsvLines(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const first = lines[0];
  if (!first) return { headers: [], rows: [] };
  const headers = splitCsvLine(first);
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

/** Split mot CSV line respect "..." quoting. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/**
 * Parse LinkedIn export zip.
 * - Phai co Profile.csv (signature).
 * - Bo qua file lai khong nam trong EXPECTED_FILES.
 * - Concat thanh plain text co heading ## <Section> + bang key/value tu CSV.
 */
export const linkedinArchiveParser: FileParser = {
  name: 'linkedin-archive',
  supports(mimeType, filename) {
    if (mimeType !== 'application/zip') return false;
    // Cho phep ten bat ky; signature thuc su kiem tra trong parse().
    return filename.toLowerCase().endsWith('.zip');
  },
  async parse(buffer: Buffer): Promise<ParseResult> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch (err) {
      throw new PermanentError(
        `Invalid zip: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    const entries = zip.getEntries();
    const byName = new Map<string, Buffer>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      // LinkedIn export co the dat file trong subfolder; lay basename.
      const base = entry.entryName.split('/').pop() ?? entry.entryName;
      byName.set(base, entry.getData());
    }

    if (!byName.has('Profile.csv')) {
      throw new PermanentError(
        'Not a LinkedIn archive: Profile.csv missing',
      );
    }

    const sections: string[] = [];
    const counts: Record<string, number> = {};

    for (const filename of EXPECTED_FILES) {
      const buf = byName.get(filename);
      if (!buf) continue;
      const csv = parseCsvLines(buf.toString('utf-8'));
      counts[filename] = csv.rows.length;

      const sectionTitle = sectionTitleFor(filename);
      sections.push(`## ${sectionTitle}`);
      for (const row of csv.rows) {
        const block = csv.headers
          .map((h, i) => `${h}: ${row[i] ?? ''}`)
          .filter((line) => line.split(':')[1]?.trim().length)
          .join('\n');
        if (block.length > 0) {
          sections.push(block);
          sections.push('');
        }
      }
    }

    return {
      text: sections.join('\n').trim(),
      metadata: { counts },
      warnings: [],
    };
  },
};

function sectionTitleFor(file: ExpectedFile): string {
  switch (file) {
    case 'Profile.csv':
      return 'Profile';
    case 'Positions.csv':
      return 'Work experience';
    case 'Education.csv':
      return 'Education';
    case 'Skills.csv':
      return 'Skills';
    case 'Certifications.csv':
      return 'Certifications';
    case 'Projects.csv':
      return 'Projects';
  }
}
