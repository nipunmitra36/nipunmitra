// Calls the deployed function handlers directly, the way Netlify invokes them
// (a web Request and a context object). Uses the index written by `npm run index`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import searchFn, { config as searchConfig } from '../netlify/functions/search.mjs';
import healthFn, { config as healthConfig } from '../netlify/functions/health.mjs';
import index from '../netlify/lib/search-index.mjs';

const BASE = 'http://localhost:8888';
let ipCounter = 0;
const call = (fn, path, init = {}, ip = `10.0.0.${++ipCounter % 250}`) => fn(new Request(BASE + path, init), { ip });

test('function routes and platform rate limit are configured', () => {
  assert.equal(searchConfig.path, '/api/v1/search');
  assert.equal(healthConfig.path, '/api/v1/health');
  assert.deepEqual(searchConfig.rateLimit.aggregateBy, ['ip', 'domain']);
  assert.ok(searchConfig.rateLimit.windowLimit > 0);
});

test('GET /api/v1/search returns structured results from the index', async () => {
  const res = await call(searchFn, '/api/v1/search?q=projects&limit=3');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('netlify-cdn-cache-control'), /durable/);
  const body = await res.json();
  assert.equal(body.query, 'projects');
  assert.equal(body.count, 3);
  assert.equal(body.source.document_count, index.document_count);
  for (const r of body.results) {
    for (const key of ['id', 'type', 'title', 'page_title', 'url', 'excerpt', 'score']) assert.ok(key in r, `missing ${key}`);
    const doc = index.documents.find((d) => d.id === r.id);
    assert.ok(doc, `result ${r.id} is not in the content index`);
    assert.equal(r.url, doc.url);
  }
});

test('invalid input gets a 400 with an error code and no caching', async () => {
  for (const [path, code] of [
    ['/api/v1/search', 'missing_query'],
    ['/api/v1/search?q=x&limit=500', 'invalid_limit'],
    ['/api/v1/search?q=x&type=admin', 'invalid_type'],
    ['/api/v1/search?q=' + 'x'.repeat(300), 'query_too_long'],
  ]) {
    const res = await call(searchFn, path);
    assert.equal(res.status, 400, path);
    assert.equal((await res.json()).error.code, code);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
});

test('only GET is accepted; OPTIONS answers CORS preflight', async () => {
  const post = await call(searchFn, '/api/v1/search?q=x', { method: 'POST', body: '{}' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS');
  const pre = await call(searchFn, '/api/v1/search', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /GET/);
});

test('per-IP limiter returns 429 with Retry-After when flooded', async () => {
  let last;
  for (let i = 0; i < 61; i++) last = await call(searchFn, `/api/v1/search?q=flood${i}`, {}, '203.0.113.9');
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  const other = await call(searchFn, '/api/v1/search?q=laravel', {}, '203.0.113.10');
  assert.equal(other.status, 200, 'other clients are unaffected');
});

test('GET /api/v1/health reports the live index', async () => {
  const res = await call(healthFn, '/api/v1/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.index.document_count, index.document_count);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
