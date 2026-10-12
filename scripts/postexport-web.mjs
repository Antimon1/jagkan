#!/usr/bin/env node
/**
 * Prepares `dist/` (from `expo export --platform web`) for GitHub Pages:
 * - .nojekyll, otherwise Pages drops the `_expo/` folder that holds the JS bundle;
 * - 404.html as a copy of index.html, so deep links like /jagkan/parent open the app.
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('dist/index.html is missing. Run `expo export --platform web` first.');
  process.exit(1);
}
writeFileSync(join(dist, '.nojekyll'), '');
copyFileSync(index, join(dist, '404.html'));
console.log('dist/ is ready for GitHub Pages.');
