import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex } from '../scripts/search-index.mjs';
import { search, parseSearchParams, tokenize, LIMITS } from '../netlify/lib/search.mjs';

const index = buildSearchIndex({ siteUrl: 'https://example.test' });
const run = (query, opts = {}) => search(index, { query, limit: 10, ...opts });

test('"projects" returns the project cards first', () => {
  const r = run('projects', { limit: 9 });
  assert.equal(r.results.length, 9);
  assert.ok(r.results.slice(0, 6).every((x) => x.type === 'projects'), r.results.map((x) => x.type).join());
});

test('technology search finds the projects built with it', () => {
  const titles = run('Laravel').results.map((x) => x.title);
  assert.ok(titles.includes('Bangladesh Medical University'));
  assert.ok(titles.includes('Al Zahra'));
});

test('contact query returns the contact page with its links', () => {
  const top = run('contact email').results[0];
  assert.equal(top.type, 'contact');
  assert.ok(top.links.some((l) => l.url === 'mailto:nipunmitra03@gmail.com'));
});

test('blog questions find the matching article', () => {
  const top = run('how do I build a booking website').results[0];
  assert.equal(top.type, 'blog');
  assert.match(top.url, /booking-website-development/);
});

test('excerpts come from the matched document and mention the query', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  for (const x of run('restaurant website').results) {
    const doc = index.documents.find((d) => d.id === x.id);
    const start = x.excerpt.replace(/^… /, '').slice(0, 60);
    assert.ok(flat(doc.text).includes(flat(start).trim()), `excerpt not from document ${x.id}: ${start}`);
    assert.ok(x.excerpt.length >= 60, `excerpt too short: ${x.excerpt}`);
  }
  assert.match(run('restaurant website').results[0].excerpt, /restaurant/i);
});

test('type filter and limit are respected', () => {
  const r = run('development', { types: ['blog'], limit: 3 });
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((x) => x.type === 'blog'));
});

test('one article never fills more than two results', () => {
  const r = run('booking website payments availability', { limit: 10 });
  const perPage = {};
  for (const x of r.results.filter((x) => x.type === 'blog')) perPage[x.url.split('#')[0]] = (perPage[x.url.split('#')[0]] || 0) + 1;
  assert.ok(Object.values(perPage).every((n) => n <= 2), JSON.stringify(perPage));
});

test('nonsense returns no results instead of guesses', () => {
  const r = run('qwxzv plorkt');
  assert.equal(r.count, 0);
  assert.deepEqual(r.results, []);
});

test('tokenizer handles framework names and plurals', () => {
  assert.deepEqual(tokenize('Next.js projects'), ['nextj', 'project']);
  assert.ok(tokenize('Node.js').includes('nodej'));
});

test('validation', () => {
  const p = (s) => parseSearchParams(new URLSearchParams(s));
  assert.equal(p('').error.code, 'missing_query');
  assert.equal(p('q=%20%20').error.code, 'missing_query');
  assert.equal(p('q=' + 'a'.repeat(LIMITS.maxQueryLength + 1)).error.code, 'query_too_long');
  assert.equal(p('q=%21%21%21').error.code, 'invalid_query');
  assert.equal(p('q=x&limit=0').error.code, 'invalid_limit');
  assert.equal(p('q=x&limit=21').error.code, 'invalid_limit');
  assert.equal(p('q=x&limit=2.5').error.code, 'invalid_limit');
  assert.equal(p('q=x&type=secrets').error.code, 'invalid_type');
  assert.deepEqual(p('q=%20laravel%00%20&limit=3&type=projects,blog').value, { query: 'laravel', limit: 3, types: ['projects', 'blog'] });
});
