/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sv } from '@/lib/i18n/sv';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** A key exists as a string, or as a plural pair (`key_one` / `key_other`). */
function hasText(key: string): boolean {
  const parts = key.split('.');
  const last = parts.pop() as string;
  let node: unknown = sv;
  for (const part of parts) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'object' || node === null) return false;
  const texts = node as Record<string, unknown>;
  return typeof texts[last] === 'string' || typeof texts[`${last}_other`] === 'string';
}

describe('i18n keys', () => {
  it('has a Swedish text for every literal key used in the code', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(join(__dirname, '..', 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!hasText(match[1])) missing.push(`${match[1]} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
