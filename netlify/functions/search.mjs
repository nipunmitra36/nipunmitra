// GET /api/v1/search?q=<query>[&limit=1-20][&type=projects,blog,…]
// Searches the portfolio's public content index (built from the site's pages at deploy time).

import index from '../lib/search-index.mjs';
import { search, parseSearchParams } from '../lib/search.mjs';
import { API_VERSION, CACHE_SUCCESS, json, error, preflight, methodNotAllowed, tooManyRequests } from '../lib/http.mjs';
import { createRateLimiter } from '../lib/rate-limit.mjs';

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export default async (req, context) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET') return methodNotAllowed();

  const gate = limiter.check(context?.ip || 'unknown');
  if (!gate.allowed) return tooManyRequests(gate.retryAfter);

  const parsed = parseSearchParams(new URL(req.url).searchParams);
  if (!parsed.ok) return error(400, parsed.error.code, parsed.error.message);

  try {
    const result = search(index, parsed.value);
    return json(
      {
        api_version: API_VERSION,
        ...result,
        source: { site: index.site, index_generated_at: index.generated_at, document_count: index.document_count },
      },
      200,
      CACHE_SUCCESS,
    );
  } catch (err) {
    console.error('search failed', err);
    return error(500, 'internal_error', 'Search failed unexpectedly. Please try again later.');
  }
};

export const config = {
  path: '/api/v1/search',
  method: ['GET', 'OPTIONS'],
  // Netlify platform rate limit (per IP + domain). Free plans allow 2 such rules per site:
  // one here and one on the MCP endpoint.
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
