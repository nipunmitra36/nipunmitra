// Writes every page of the site as a plain .html file in the project root (and blog/),
// so the site can be opened straight from disk. Run with `npm run generate`.

import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPage, baseFor } from '../src/layout.mjs';
import { responsiveImages } from './images.mjs';
import { pages } from '../src/pages.mjs';
import { posts } from '../src/posts.mjs';
import { blogIndexPage, postPage } from '../src/blog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function allPages() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  return [...pages, blogIndexPage(sorted), ...sorted.map((p) => postPage(p, sorted))];
}

export function generate() {
  // Clear old article files so renamed or deleted posts don't linger.
  mkdirSync(join(ROOT, 'blog'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'blog'))) if (f.endsWith('.html')) rmSync(join(ROOT, 'blog', f));

  const list = allPages();
  for (const p of list) {
    const html = responsiveImages(renderPage(p), baseFor(p.file)).replaceAll('{{YEAR}}', String(new Date().getFullYear()));
    writeFileSync(join(ROOT, p.file), html);
  }
  return list;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = generate();
  console.log(`Generated ${list.length} pages: ${list.map((p) => p.file).join(', ')}`);
}
