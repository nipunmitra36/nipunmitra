// Production build: `npm run build` → dist/
//
// - Regenerates every page from src/ (same as `npm run generate`).
// - Fills {{SITE_URL}} (canonical, Open Graph, structured data) with the live URL.
//   The URL is picked up automatically on Vercel and Netlify; anywhere else pass it
//   as an argument (`npm run build -- https://example.com`) or set SITE_URL.
// - Builds responsive WebP images (scripts/images.mjs).
// - Compiles Tailwind into a minified stylesheet instead of the CDN, inlines the small
//   font/site CSS into each page, and fingerprints JS/CSS for long-term caching.
// - Writes robots.txt, sitemap.xml, llms.txt, the blog RSS feed and cache headers for common hosts.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { generate } from './scripts/generate.mjs';
import { buildImages } from './scripts/images.mjs';
import { writeSearchIndex } from './scripts/search-index.mjs';
import { openApi, openAiTools } from './scripts/api-docs.mjs';
import { baseFor, canonicalFor } from './src/layout.mjs';
import { posts } from './src/posts.mjs';

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

await buildImages();
const pages = generate();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });

const hashed = (name, ext, content) => {
  const file = `assets/${name}.${createHash('sha256').update(content).digest('hex').slice(0, 10)}.${ext}`;
  writeFileSync(join(OUT, file), content);
  return file;
};

// ---------- Tailwind ----------
const twSource = readFileSync('assets/tailwind.config.js', 'utf8');
const tw = {};
new Function('tailwind', twSource)(tw);

const tmp = join(tmpdir(), `nm-tw-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const configFile = join(tmp, 'tailwind.config.cjs');
const inputFile = join(tmp, 'input.css');
const cssFile = join(tmp, 'out.css');
const content = [...pages.map((p) => p.file), 'assets/main.js'].map((f) => join(process.cwd(), f).replace(/\\/g, '/'));
writeFileSync(configFile, `module.exports = ${JSON.stringify({ ...tw.config, content })};`);
writeFileSync(inputFile, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-c', configFile, '-i', inputFile, '-o', cssFile, '--minify'], { stdio: 'inherit' });
const tailwindCss = readFileSync(cssFile);
rmSync(tmp, { recursive: true, force: true });

const assets = {
  main: hashed('main', 'js', readFileSync('assets/main.js')),
};

// ---------- Font Awesome subset ----------
// The full stylesheet defines ~2,000 icons; keep only the icon rules the site actually uses.
const FA = 'assets/vendor/fontawesome-6.5.1';
const usedIcons = new Set();
for (const f of [...pages.map((p) => p.file), 'assets/main.js']) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\bfa-([a-z0-9-]+)/g)) usedIcons.add(m[1]);
}
const faFull = readFileSync(`${FA}/css/all.min.css`, 'utf8');
let faCss = '', depth = 0, start = 0;
for (let i = 0; i < faFull.length; i++) {
  if (faFull[i] === '{') depth++;
  else if (faFull[i] === '}' && --depth === 0) {
    const rule = faFull.slice(start, i + 1);
    const selectors = rule.slice(0, rule.indexOf('{')).split(',');
    const iconOnly = selectors.every((s) => /^\s*\.fa-[a-z0-9-]+::?before\s*$/.test(s));
    if (!iconOnly || selectors.some((s) => usedIcons.has(s.trim().replace(/^\.fa-/, '').replace(/::?before$/, '')))) faCss += rule;
    start = i + 1;
  }
}
faCss = faCss.replace(/^\/\*[\s\S]*?\*\//, '').replaceAll('../webfonts/', `vendor/fontawesome-6.5.1/webfonts/`);
assets.fontawesome = hashed('fontawesome', 'css', faCss);
console.log(`Font Awesome: ${usedIcons.size} icon names used, CSS ${(faFull.length / 1024).toFixed(0)} KB → ${(faCss.length / 1024).toFixed(0)} KB`);

// ---------- Pages ----------
const fill = (s) => s.replaceAll('{{SITE_URL}}', SITE_URL).replaceAll('{{BUILD_DATE}}', BUILD_DATE);
// All page CSS (Tailwind ≈ 6 KB gzipped + fonts + site styles) is inlined, so the first paint
// never waits on a stylesheet request. Font URLs follow the page's folder depth.
const pageCss = (base) =>
  tailwindCss.toString() + '\n' +
  (readFileSync('assets/fonts.css', 'utf8').replaceAll('url(fonts/', `url(${base}assets/fonts/`) + readFileSync('assets/site.css', 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
for (const p of pages) {
  const base = baseFor(p.file);
  const html = fill(readFileSync(p.file, 'utf8'))
    .replace(/\s*<!-- Tailwind CDN for local preview[^\n]*\n\s*<!-- build:tailwind -->[\s\S]*?<!-- \/build:tailwind -->/, '')
    .replace(/<!-- build:inline-css[^>]*-->[\s\S]*?<!-- \/build:inline-css -->/, () => `<style>\n${pageCss(base)}\n  </style>`)
    .replace(/<!-- build:preload-fonts[^>]*-->/, ['space-grotesk', 'orbitron']
      .map((f) => `<link rel="preload" href="${base}assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin />`).join('\n  '))
    .replace(`"${base}assets/main.js"`, `"${base}${assets.main}"`)
    .replaceAll(`"${base}${FA}/css/all.min.css"`, `"${base}${assets.fontawesome}"`)
    .replace(/<!-- Generated by scripts\/generate\.mjs[^\n]*-->\n/, '');
  mkdirSync(join(OUT, dirname(p.file)), { recursive: true });
  writeFileSync(join(OUT, p.file), html);
}
writeFileSync(join(OUT, '404.html'), fill(readFileSync('404.html', 'utf8')));

// ---------- Search API (Netlify Functions in netlify/functions/) ----------
// The content index is rebuilt from the freshly generated pages; Netlify bundles it with the
// functions after this build step. Machine-readable API docs go next to the site.
const searchIndex = writeSearchIndex({ siteUrl: SITE_URL });
mkdirSync(join(OUT, 'api', 'v1'), { recursive: true });
writeFileSync(join(OUT, 'api', 'v1', 'openapi.json'), JSON.stringify(openApi(SITE_URL), null, 2) + '\n');
writeFileSync(join(OUT, 'api', 'v1', 'openai-tools.json'), JSON.stringify(openAiTools(SITE_URL), null, 2) + '\n');
console.log(`Search index: ${searchIndex.document_count} documents (${Object.entries(searchIndex.counts).map(([t, c]) => `${t} ${c}`).join(', ')})`);

// ---------- Static files ----------
for (const f of [
  'images', 'assets/fonts', 'assets/fonts.css', 'assets/icons', 'assets/vendor', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'site.webmanifest', 'og-image.jpg',
  'planet-1.png', 'planet-2.png', 'planet-3.png', '3d-astronaut.png', 'astronaut-in-spacesuit.png', 'nipun_mitra_software_developer.jpg',
]) {
  if (!existsSync(f)) throw new Error(`Missing ${f}`);
  cpSync(f, join(OUT, f), { recursive: true });
}

// ---------- Cache headers ----------
// Fingerprinted / versioned files never change, so they can be cached for a year;
// HTML always revalidates so new content shows up immediately.
// _headers is read by Netlify and Cloudflare Pages, .htaccess by Apache / cPanel hosting
// (Vercel uses vercel.json).
writeFileSync(join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/images/opt/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate
`);
writeFileSync(join(OUT, '.htaccess'), `# Apache / cPanel: compression and cache lifetimes
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml text/plain application/xml
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(css|js|woff2|webp|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(png|jpg|ico|webmanifest)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
  <FilesMatch "\\.html$">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </FilesMatch>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
ErrorDocument 404 /404.html
`);

// ---------- RSS ----------
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
const url = (file) => fill(canonicalFor(file));
mkdirSync(join(OUT, 'blog'), { recursive: true });
writeFileSync(join(OUT, 'blog', 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Nipun Mitra — Web Development Blog</title>
    <link>${url('blog.html')}</link>
    <description>Guides on custom software, frontend websites, restaurant and booking websites, and web app development.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${sorted.map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${url(`blog/${p.slug}.html`)}</link>
      <guid>${url(`blog/${p.slug}.html`)}</guid>
      <pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate>
      <description>${xml(p.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`);

// ---------- robots.txt ----------
// Search engines and AI assistants are explicitly welcome, so the site can show up in both.
const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];
writeFileSync(join(OUT, 'robots.txt'), `# robots.txt — ${SITE_URL}
User-agent: *
Allow: /

# AI search and assistants
${aiBots.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`);

// ---------- llms.txt + llms-full.txt (https://llmstxt.org) ----------
const text = (html) =>
  html
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n### $1\n')
    .replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n')
    .replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, label) => `${label} (${/^https?:/.test(href) ? href : `${SITE_URL}/blog/${href}`.replace('/blog/../', '/')})`)
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const projectsLd = JSON.parse(readFileSync('src/home-jsonld.json', 'utf8'))['@graph'].find((n) => n['@type'] === 'ItemList').itemListElement;
const mainPages = pages.filter((p) => !p.file.startsWith('blog/'));
const intro = `# Nipun Mitra

> Software developer in Dhaka, Bangladesh with 3+ years of experience building fast, SEO-friendly websites and web apps with React, Next.js, TypeScript, Tailwind CSS, Laravel and WordPress. Currently a frontend developer at CodeWare Ltd. Offers custom software development, app development, UI/UX design, web design and development, and SEO and digital marketing.

- Email: nipunmitra03@gmail.com
- Phone / WhatsApp: +88 01761 227436 (https://wa.me/8801761227436)
- GitHub: https://github.com/nipunmitra36
- LinkedIn: https://www.linkedin.com/in/nipunmitra
`;

writeFileSync(join(OUT, 'llms.txt'), `${intro}
## Pages

${mainPages.map((p) => `- [${p.title}](${url(p.file)}): ${p.description}`).join('\n')}

## Projects

${projectsLd.map((i) => `- [${i.item.name}](${i.item.url})`).join('\n')}

## Blog

${sorted.map((p) => `- [${p.title}](${url(`blog/${p.slug}.html`)}): ${p.description}`).join('\n')}

## Search API

- [Search endpoint](${SITE_URL}/api/v1/search?q=projects): \`GET /api/v1/search?q=<query>&limit=1-20&type=<types>\` — JSON results with titles, URLs and excerpts from this site
- [OpenAPI description](${SITE_URL}/api/v1/openapi.json)
- [OpenAI function-calling tool definitions](${SITE_URL}/api/v1/openai-tools.json)
- MCP server (Streamable HTTP): ${SITE_URL}/mcp — tool \`search_portfolio\`

## Optional

- [Full text of every article](${SITE_URL}/llms-full.txt)
- [RSS feed](${SITE_URL}/blog/rss.xml)
- [Sitemap](${SITE_URL}/sitemap.xml)
`);

writeFileSync(join(OUT, 'llms-full.txt'), `${intro}
${sorted.map((p) => `---

# ${p.title}

URL: ${url(`blog/${p.slug}.html`)}
Published: ${p.date}
Topic: ${p.keyword}

${text(p.html)}

## Frequently asked questions

${p.faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}
`).join('\n')}`);

// ---------- sitemap.xml ----------

const projectImages = ['cwskills', 'bmu', 'crystalvalet', 'sonyrangs', 'idesk360', 'cwticket', 'alzahra', 'technovision', 'alnoor'].map((p) => `images/projects/${p}.jpg`);
const imagesFor = (file) =>
  file === 'index.html' ? ['og-image.jpg']
  : file === 'projects.html' ? projectImages
  : file.startsWith('blog/') ? [`images/blog/${file.slice(5, -5)}.jpg`]
  : [];

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => [
  '  <url>',
  `    <loc>${url(p.file)}</loc>`,
  `    <lastmod>${BUILD_DATE}</lastmod>`,
  ...imagesFor(p.file).map((i) => `    <image:image><image:loc>${SITE_URL}/${i}</image:loc></image:image>`),
  '  </url>',
].join('\n')).join('\n')}
</urlset>
`);

console.log(`Built ${OUT}/ for ${SITE_URL} — ${pages.length} pages (CSS inlined: Tailwind ${(tailwindCss.length / 1024).toFixed(1)} KB)`);
