// Builds the content index used by the search API (netlify/functions/*).
//
// Source of truth: the generated pages themselves (index.html, about.html, …, blog/*.html),
// i.e. exactly what visitors see. Each page is split into sections at its h1/h2 headings;
// project cards become one document each. Blocks marked `data-search-ignore` (call-to-action
// bands, "keep reading" lists, the third-party reference), forms, scripts and decorative
// elements are skipped. No private data or secrets exist in these pages.
//
// Run: `npm run index [-- https://site-url]` (the production build runs it automatically).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { allPages } from './generate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX_FILE = join(ROOT, 'netlify', 'lib', 'search-index.mjs');

// Which pages are indexed, and as what type. index.html contributes only its hero (profile summary);
// its other sections repeat content from the dedicated pages. blog.html is a list of article cards.
const PAGE_TYPES = {
  'index.html': { type: 'about', only: '#home' },
  'about.html': { type: 'about' },
  'services.html': { type: 'services' },
  'skills.html': { type: 'skills' },
  'experience.html': { type: 'experience' },
  'projects.html': { type: 'projects' },
  'education.html': { type: 'education' },
  'contact.html': { type: 'contact' },
  'downloads.html': { type: 'downloads' },
};
const typeFor = (file) => PAGE_TYPES[file] || (file.startsWith('blog/') ? { type: 'blog' } : null);

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'img', 'picture', 'form', 'noscript', 'canvas', 'iframe', 'button']);
// Inline tags that sit side by side without spaces in the HTML (tech tags, labels): keep a word break.
const SPACED_TAGS = new Set(['span', 'time', 'label']);
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'header', 'footer', 'aside', 'figure', 'details', 'summary', 'h3', 'h4', 'h5', 'h6', 'br', 'tr', 'blockquote', 'nav', 'dl', 'dt', 'dd']);

const clean = (s) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'section';

function ignored(el) {
  const tag = el.rawTagName?.toLowerCase();
  return (
    SKIP_TAGS.has(tag) ||
    el.hasAttribute?.('data-search-ignore') ||
    el.getAttribute?.('aria-hidden') === 'true' ||
    (tag === 'nav' && /breadcrumb/i.test(el.getAttribute('aria-label') || '')) ||
    el.classList?.contains('sr-only') ||
    el.getAttribute?.('id') === 'form-status'
  );
}

/** Visible text of an element, with line breaks between blocks. */
function textOf(node) {
  if (node.nodeType === 3) return node.text;
  if (node.nodeType !== 1 || ignored(node)) return '';
  const tag = node.rawTagName?.toLowerCase();
  const inner = node.childNodes.map(textOf).join('');
  return BLOCK_TAGS.has(tag) ? `\n${inner}\n` : SPACED_TAGS.has(tag) ? ` ${inner} ` : inner;
}

function absolute(href, file, siteUrl) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
  if (/^(mailto:|tel:)/i.test(href)) return href;
  if (/^https?:\/\//i.test(href)) {
    const u = new URL(href);
    if (u.hostname === 'wa.me') return `${u.origin}${u.pathname}`; // drop the prefilled message
    return u.toString();
  }
  const path = posix.normalize(posix.join(posix.dirname(file), href.split('#')[0]));
  return path === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${path}`;
}

function collectLinks(el, file, siteUrl, into) {
  for (const a of el.querySelectorAll('a[href]')) {
    if (a.closest('[data-search-ignore]')) continue;
    const url = absolute(a.getAttribute('href'), file, siteUrl);
    const label = clean(textOf(a)).replace(/\s+/g, ' ') || a.getAttribute('aria-label') || '';
    if (url && label && !into.some((l) => l.url === url)) into.push({ label, url });
  }
}

/** Split one rendered page into searchable documents. */
function documentsFor(file, html, siteUrl) {
  const meta = typeFor(file);
  if (!meta) return [];
  const dom = parse(html);
  const pageTitle = clean(dom.querySelector('title')?.text || file);
  const root = meta.only ? dom.querySelector(meta.only) : dom.querySelector('main');
  if (!root) throw new Error(`No content root in ${file}`);
  const pageUrl = file === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${file}`;

  const chunks = [];
  let cur = null;
  // `linkable`: the anchor is a real element id on the page, so the result URL can point straight at it.
  const start = (heading, anchor, linkable = false) => { cur = { heading, anchor, linkable, parts: [], links: [] }; chunks.push(cur); return cur; };
  start(null, null);

  const walk = (node) => {
    if (node.nodeType === 3) { cur.parts.push(node.text); return; }
    if (node.nodeType !== 1 || ignored(node)) return;
    const tag = node.rawTagName?.toLowerCase();

    // A project card (an <a> wrapping the whole card) is one document linking to the live site.
    if (node.classList?.contains('project-card')) {
      const heading = clean(node.querySelector('h1, h2, h3')?.text || '');
      const card = start(heading, node.getAttribute('id') || slug(heading), !!node.getAttribute('id'));
      card.parts.push(textOf(node));
      card.links.push({ label: `${heading} (live site)`, url: absolute(node.getAttribute('href'), file, siteUrl) });
      start(null, null);
      return;
    }
    // Any other card (an <article> or .glass box with exactly one main heading) is also one document,
    // so details placed above its heading (dates, labels) stay with it.
    const cardHeads = tag === 'article' && !node.querySelector('h1, h2') ? node.querySelectorAll('h3') : node.querySelectorAll('h1, h2');
    if (node !== root && (tag === 'article' || node.classList?.contains('glass')) && cardHeads.length === 1) {
      const h = cardHeads[0];
      const id = node.getAttribute('id') || h.getAttribute('id');
      const card = start(clean(h.text).replace(/\s+/g, ' '), id || null, !!id);
      card.parts.push(textOf(node));
      collectLinks(node, file, siteUrl, card.links);
      start(null, null); // text after the card doesn't belong to it
      return;
    }
    if (tag === 'h1' || tag === 'h2') {
      start(clean(node.text).replace(/\s+/g, ' '), node.getAttribute('id') || null, !!node.getAttribute('id'));
      return;
    }
    if (tag === 'a' && node.getAttribute('href')) {
      const url = absolute(node.getAttribute('href'), file, siteUrl);
      const label = clean(textOf(node)).replace(/\s+/g, ' ') || node.getAttribute('aria-label') || '';
      if (url && label && !cur.links.some((l) => l.url === url)) cur.links.push({ label, url });
    }
    const sep = BLOCK_TAGS.has(tag) ? '\n' : SPACED_TAGS.has(tag) ? ' ' : '';
    cur.parts.push(sep);
    node.childNodes.forEach(walk);
    cur.parts.push(sep);
  };
  root.childNodes.forEach(walk);

  // Untitled text (a lead-in, or text right after a card) belongs to the nearest titled section before it,
  // or to the first one when it opens the page.
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].heading) continue;
    const target = chunks.slice(0, i).reverse().find((c) => c.heading) || chunks.slice(i + 1).find((c) => c.heading);
    if (target) target.parts.push('\n', ...chunks[i].parts);
  }

  const seen = new Map();
  const docs = [];
  for (const c of chunks) {
    const text = clean(c.parts.join(''));
    // skip sections that are little more than their heading
    if (!c.heading || text.replace(c.heading, '').trim().length < 25) continue;
    let title = c.heading;
    // Repeated headings on one page (e.g. two "Frontend Developer" roles) get their first detail line.
    const firstLine = text.split('\n').find((l) => l && l !== c.heading);
    if (chunks.filter((x) => x.heading === c.heading).length > 1 && firstLine) title = `${c.heading} — ${firstLine}`;
    let id = `${file.replace(/\.html$/, '')}#${c.anchor || slug(title)}`;
    seen.set(id, (seen.get(id) || 0) + 1);
    if (seen.get(id) > 1) id += `-${seen.get(id)}`;
    docs.push({
      id,
      type: meta.type,
      title,
      page_title: pageTitle,
      url: c.linkable ? `${pageUrl}#${c.anchor}` : pageUrl,
      text: text.length > 4000 ? text.slice(0, 4000) : text,
      links: c.links.filter((l) => l.url !== pageUrl).slice(0, 12),
    });
  }
  // Contact links anywhere on the contact page are attached to its main document.
  if (meta.type === 'contact' && docs[0]) collectLinks(root, file, siteUrl, docs[0].links);
  return docs;
}

/** Build the index from the generated pages on disk. */
export function buildSearchIndex({ siteUrl, files = allPages().map((p) => p.file), generatedAt = new Date().toISOString() }) {
  const site = siteUrl.replace(/\/+$/, '');
  const documents = files.flatMap((file) => documentsFor(file, readFileSync(join(ROOT, file), 'utf8'), site));
  const leaks = documents.filter((d) => /\{\{[A-Z_]+\}\}/.test(d.text + d.url + JSON.stringify(d.links)));
  if (leaks.length) throw new Error(`Unfilled template placeholder in ${leaks[0].id}`);
  const counts = documents.reduce((m, d) => ((m[d.type] = (m[d.type] || 0) + 1), m), {});
  return { version: 1, site: site, generated_at: generatedAt, document_count: documents.length, counts, documents };
}

export function writeSearchIndex(options) {
  const index = buildSearchIndex(options);
  mkdirSync(dirname(INDEX_FILE), { recursive: true });
  writeFileSync(
    INDEX_FILE,
    `// Generated by scripts/search-index.mjs from the site's pages — do not edit by hand.\n` +
      `// Rebuilt on every \`npm run build\` (and by \`npm run index\`).\n` +
      `export default ${JSON.stringify(index, null, 1)};\n`,
  );
  return index;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const siteUrl = process.argv[2] || process.env.SITE_URL || process.env.URL || 'http://localhost:8888';
  const index = writeSearchIndex({ siteUrl });
  console.log(`Search index: ${index.document_count} documents for ${index.site} → ${INDEX_FILE.replace(ROOT, '.')}`);
  console.log(Object.entries(index.counts).map(([t, c]) => `  ${t}: ${c}`).join('\n'));
}
