// GET /api/v1/health — reports whether the search API is up and which content index it serves.

import index from '../lib/search-index.mjs';
import { API_VERSION, NO_STORE, json, error, preflight, methodNotAllowed } from '../lib/http.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET') return methodNotAllowed();
  try {
    const ok = Array.isArray(index.documents) && index.documents.length > 0;
    return json(
      {
        status: ok ? 'ok' : 'degraded',
        api_version: API_VERSION,
        time: new Date().toISOString(),
        index: { site: index.site, generated_at: index.generated_at, document_count: index.document_count, counts: index.counts },
        endpoints: { search: '/api/v1/search?q=…', health: '/api/v1/health', mcp: '/mcp', openapi: '/api/v1/openapi.json', tools: '/api/v1/openai-tools.json' },
      },
      ok ? 200 : 503,
      NO_STORE,
    );
  } catch (err) {
    console.error('health check failed', err);
    return error(503, 'unhealthy', 'The search index could not be loaded.');
  }
};

export const config = { path: '/api/v1/health', method: ['GET', 'OPTIONS'] };
