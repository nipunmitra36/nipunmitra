// Builds responsive WebP versions of the site's images into images/opt/ and writes
// images/opt/manifest.json. scripts/generate.mjs uses the manifest to add srcset/sizes.
// File names carry a content hash, so they can be cached for a year safely.
//
// Run with `npm run images` after adding or replacing an image.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'images', 'opt');

const decorative = [160, 320, 500];   // planets / astronauts (shown at 90–340 px)
const screenshot = [400, 800, 1200];  // project screenshots and blog covers (1200 × 630)

const sources = [
  ...['planet-1.png', 'planet-2.png', 'planet-3.png', '3d-astronaut.png'].map((f) => [f, decorative]),
  ['astronaut-in-spacesuit.png', [200, 408]],
  ['nipun_mitra_software_developer.jpg', [400, 640, 938]],
  ['images/apps/daily-cost.png', [96, 192, 384]],
  ...readdirSync(join(ROOT, 'images', 'projects')).filter((f) => f.endsWith('.jpg')).map((f) => [`images/projects/${f}`, screenshot]),
  ...readdirSync(join(ROOT, 'images', 'blog')).filter((f) => f.endsWith('.jpg')).map((f) => [`images/blog/${f}`, screenshot]),
];

export async function buildImages() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const manifest = {};
  let before = 0, after = 0;

  for (const [src, widths] of sources) {
    const input = readFileSync(join(ROOT, src));
    const meta = await sharp(input).metadata();
    const hash = createHash('sha256').update(input).digest('hex').slice(0, 8);
    const name = basename(src, extname(src));
    const variants = [];
    for (const w of widths.filter((w) => w <= meta.width)) {
      const file = `${name}-${hash}-${w}.webp`;
      const out = await sharp(input).resize({ width: w }).webp({ quality: 78, alphaQuality: 85, effort: 5 }).toBuffer();
      writeFileSync(join(OUT, file), out);
      variants.push({ w, file: `images/opt/${file}` });
      after += out.length;
    }
    before += input.length;
    manifest[src] = { width: meta.width, height: meta.height, variants };
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { count: sources.length, before, after };
}

// Adds srcset to every <img> whose src is in the manifest, and points src at a mid-size WebP.
// `sizes` comes from the <img> itself (each template sets it to the real display size).
export function responsiveImages(html, base) {
  const file = join(OUT, 'manifest.json');
  if (!existsSync(file)) return html;
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = tag.match(/\ssrc="([^"]+)"/);
    if (!m || !m[1].startsWith(base)) return tag;
    const entry = manifest[m[1].slice(base.length)];
    if (!entry) return tag;
    const v = entry.variants;
    const fallback = v.find((x) => x.w >= 400) || v[v.length - 1];
    const srcset = v.map((x) => `${base}${x.file} ${x.w}w`).join(', ');
    let out = tag.replace(m[0], ` src="${base}${fallback.file}" srcset="${srcset}"`);
    if (!/\ssizes="/.test(out)) out = out.replace('<img', '<img sizes="100vw"');
    return out;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { count, before, after } = await buildImages();
  console.log(`Optimised ${count} images: ${(before / 1024).toFixed(0)} KB of originals → ${(after / 1024).toFixed(0)} KB of WebP variants (all sizes).`);
}
