// Production build: `npm run build` → dist/
//
// - Fills {{SITE_URL}} (canonical, Open Graph, structured data) with the live URL.
//   The URL is picked up automatically on Vercel and Netlify; anywhere else pass it
//   as an argument (`npm run build -- https://example.com`) or set SITE_URL.
// - Compiles Tailwind into a minified, content-hashed stylesheet instead of the CDN.
// - Renders the blog (index, one page per post, RSS) to static HTML.
// - Writes robots.txt and sitemap.xml.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { posts } from './blog/posts.mjs';
import { renderIndex, renderPost } from './blog/template.mjs';

const require = createRequire(import.meta.url);
const OUT = 'dist';

const detected =
  process.argv[2] ||
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  process.env.URL; // Netlify's primary site URL

if (!detected) {
  console.error('No site URL. Run `npm run build -- https://your-domain.com` or set SITE_URL.');
  process.exit(1);
}
const SITE_URL = detected.replace(/\/+$/, '');
const BUILD_DATE = new Date().toISOString().slice(0, 10);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });

const hashed = (name, ext, content) => {
  const file = `assets/${name}.${createHash('sha256').update(content).digest('hex').slice(0, 10)}.${ext}`;
  writeFileSync(join(OUT, file), content);
  return file;
};

// ---------- Tailwind ----------
let html = readFileSync('index.html', 'utf8');
const block = /<!-- build:tailwind -->[\s\S]*?<!-- \/build:tailwind -->/;
const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
if (!block.test(html) || !configMatch) throw new Error('Tailwind dev block not found in index.html');

// index.html is the single source of truth for the Tailwind theme.
const theme = new Function(`return ${configMatch[1]}`)();
const tmp = join(tmpdir(), `nm-tw-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const configFile = join(tmp, 'tailwind.config.cjs');
const inputFile = join(tmp, 'input.css');
const cssFile = join(tmp, 'out.css');
const content = [join(process.cwd(), 'index.html'), join(process.cwd(), 'blog', '*.mjs')].map((p) => p.replace(/\\/g, '/'));
writeFileSync(configFile, `module.exports = ${JSON.stringify({ ...theme, content })};`);
writeFileSync(inputFile, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-c', configFile, '-i', inputFile, '-o', cssFile, '--minify'], { stdio: 'inherit' });

const tailwindCss = readFileSync(cssFile);
rmSync(tmp, { recursive: true, force: true });
const css = {
  tailwind: hashed('tailwind', 'css', tailwindCss),
  blog: hashed('blog', 'css', readFileSync('blog/blog.css')),
};

// ---------- Home + 404 ----------
const fill = (s) => s.replaceAll('{{SITE_URL}}', SITE_URL).replaceAll('{{BUILD_DATE}}', BUILD_DATE);
html = html.replace(block, `<link rel="stylesheet" href="${css.tailwind}" />`);
writeFileSync(join(OUT, 'index.html'), fill(html));
writeFileSync(join(OUT, '404.html'), fill(readFileSync('404.html', 'utf8')));

// ---------- Blog ----------
const ctx = { site: SITE_URL, css, buildDate: BUILD_DATE };
const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
mkdirSync(join(OUT, 'blog'), { recursive: true });
writeFileSync(join(OUT, 'blog', 'index.html'), renderIndex(sorted, ctx));
for (const post of sorted) {
  if (!existsSync(`images/blog/${post.slug}.jpg`)) throw new Error(`Missing images/blog/${post.slug}.jpg`);
  mkdirSync(join(OUT, 'blog', post.slug), { recursive: true });
  writeFileSync(join(OUT, 'blog', post.slug, 'index.html'), renderPost(post, sorted, ctx));
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
writeFileSync(join(OUT, 'blog', 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Nipun Mitra — Web Development Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Guides on custom software, frontend websites, restaurant and booking websites, and web app development.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${sorted.map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid>${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate>
      <description>${xml(p.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`);

// ---------- Static files ----------
for (const f of [
  'images', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'site.webmanifest', 'og-image.jpg',
  'planet-1.png', 'planet-2.png', 'planet-3.png', '3d-astronaut.png', '3d-rendring-astronaut-removebg-preview.png',
]) {
  if (!existsSync(f)) throw new Error(`Missing ${f}`);
  cpSync(f, join(OUT, f), { recursive: true });
}

// ---------- robots.txt + sitemap.xml ----------
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const projectImages = ['cwskills', 'bmu', 'crystalvalet', 'sonyrangs', 'idesk360', 'cwticket', 'alzahra', 'technovision', 'alnoor'];
const img = (path) => `    <image:image><image:loc>${SITE_URL}/${path}</image:loc></image:image>`;
const url = (loc, lastmod, images = []) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
${images.map(img).join('\n')}
  </url>`.replace(/\n\n/g, '\n');

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${url(`${SITE_URL}/`, BUILD_DATE, ['og-image.jpg', ...projectImages.map((p) => `images/projects/${p}.jpg`)])}
${url(`${SITE_URL}/blog/`, BUILD_DATE)}
${sorted.map((p) => url(`${SITE_URL}/blog/${p.slug}/`, BUILD_DATE > p.date ? BUILD_DATE : p.date, [`images/blog/${p.slug}.jpg`])).join('\n')}
</urlset>
`);

console.log(`Built ${OUT}/ for ${SITE_URL} — home, blog index, ${sorted.length} posts (${css.tailwind}, ${(tailwindCss.length / 1024).toFixed(1)} KB)`);
