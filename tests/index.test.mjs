// The content index must contain the site's real public content — and nothing else.
// Expected values are read from the source files (posts.mjs, sections/*.html), not hard-coded copies of results.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchIndex } from '../scripts/search-index.mjs';
import { posts } from '../src/posts.mjs';

const SITE = 'https://example.test';
const index = buildSearchIndex({ siteUrl: SITE });
const byType = (t) => index.documents.filter((d) => d.type === t);

test('covers every content area', () => {
  for (const t of ['about', 'services', 'skills', 'experience', 'projects', 'education', 'blog', 'contact']) {
    assert.ok(byType(t).length > 0, `no "${t}" documents`);
  }
});

test('every project card on the site is indexed with its live link', () => {
  const html = readFileSync(new URL('../src/sections/projects.html', import.meta.url), 'utf8');
  const cards = [...html.matchAll(/<a id="([^"]+)" href="(https:[^"]+)"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g)];
  assert.ok(cards.length >= 9);
  for (const [, id, href, name] of cards) {
    const doc = index.documents.find((d) => d.type === 'projects' && d.title === name);
    assert.ok(doc, `project "${name}" missing`);
    assert.equal(doc.url, `${SITE}/projects.html#${id}`);
    assert.ok(doc.links.some((l) => l.url.startsWith(href)), `${name}: live link ${href} missing`);
  }
});

test('every blog article is indexed with its title and URL', () => {
  for (const p of posts) {
    const doc = index.documents.find((d) => d.type === 'blog' && d.title === p.title);
    assert.ok(doc, `article "${p.title}" missing`);
    assert.equal(doc.url, `${SITE}/blog/${p.slug}.html`);
    assert.match(doc.text, new RegExp(p.description.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('article sections link to their heading anchors', () => {
  const section = index.documents.find((d) => d.id === 'blog/booking-website-development#avoiding-double-bookings');
  assert.ok(section);
  assert.equal(section.url, `${SITE}/blog/booking-website-development.html#avoiding-double-bookings`);
});

test('public contact links are present', () => {
  const contact = byType('contact')[0];
  const urls = contact.links.map((l) => l.url);
  for (const expected of ['mailto:nipunmitra03@gmail.com', 'tel:+8801761227436', 'https://wa.me/8801761227436', 'https://github.com/nipunmitra36']) {
    assert.ok(urls.includes(expected), `missing ${expected}`);
  }
  assert.ok(!urls.some((u) => u.includes('?text=')), 'WhatsApp prefilled message should be stripped');
});

test('experience and education keep their dates', () => {
  assert.ok(byType('experience').some((d) => /CodeWare/.test(d.title) && /Aug 2022/.test(d.text)));
  assert.ok(byType('education').some((d) => /B\.Sc\./.test(d.title) && /2023/.test(d.text)));
});

test('excludes non-content and third-party details', () => {
  const all = JSON.stringify(index.documents);
  assert.doesNotMatch(all, /\{\{[A-Z_]+\}\}/, 'template placeholder leaked');
  assert.doesNotMatch(all, /Mahabubul/, 'reference person should not be served by the API');
  assert.doesNotMatch(all, /Have a project in mind\?/, 'call-to-action band should be skipped');
  assert.doesNotMatch(all, /Your name|you@example\.com/, 'form fields should be skipped');
  assert.doesNotMatch(all, /formsubmit/i);
});

test('document ids are unique and URLs are absolute', () => {
  const ids = index.documents.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const d of index.documents) assert.ok(d.url.startsWith(SITE + '/'), d.url);
});
