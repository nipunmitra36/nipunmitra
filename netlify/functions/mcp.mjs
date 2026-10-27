// POST /mcp — Model Context Protocol server (Streamable HTTP, stateless, JSON responses).
// Exposes one read-only tool, `search_portfolio`, backed by the same search as /api/v1/search.
// Follows Netlify's guide: a fresh server + Web-standard transport per request, POST only.
// No authentication: it serves only public website content, protected by rate limiting.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import index from '../lib/search-index.mjs';
import { search, parseSearchParams, TYPES, LIMITS } from '../lib/search.mjs';
import { error, tooManyRequests } from '../lib/http.mjs';
import { createRateLimiter } from '../lib/rate-limit.mjs';

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

export const SEARCH_TOOL_DESCRIPTION =
  "Search the public portfolio website of Nipun Mitra, a software developer in Dhaka, Bangladesh. " +
  'Covers his background, skills and technologies, services, work experience, projects, education, ' +
  'blog articles and public contact links. Returns matching sections with page titles, original URLs and excerpts.';

function buildServer() {
  const server = new McpServer({ name: 'nipun-mitra-portfolio', version: '1.0.0' });
  server.registerTool(
    'search_portfolio',
    {
      title: 'Search Nipun Mitra’s portfolio',
      description: SEARCH_TOOL_DESCRIPTION,
      inputSchema: {
        query: z.string().min(1).max(LIMITS.maxQueryLength).describe('What to look for, e.g. "projects", "Laravel experience", "contact email".'),
        limit: z.number().int().min(1).max(LIMITS.maxLimit).optional().describe(`Maximum results (1–${LIMITS.maxLimit}, default ${LIMITS.defaultLimit}).`),
        type: z.array(z.enum(TYPES)).optional().describe('Only return these content types.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, limit, type }) => {
      const parsed = parseSearchParams({ q: query, limit: limit ?? '', type: type ?? '' });
      if (!parsed.ok) return { isError: true, content: [{ type: 'text', text: parsed.error.message }] };
      const result = { ...search(index, parsed.value), source: { site: index.site, index_generated_at: index.generated_at } };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
    },
  );
  return server;
}

const withCors = (res) => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
  // GET would open a server-sent-events stream that a serverless function can't hold open.
  if (req.method !== 'POST') return withCors(error(405, 'method_not_allowed', 'This MCP endpoint accepts POST requests (Streamable HTTP, stateless).', { Allow: 'POST, OPTIONS' }));

  const gate = limiter.check(context?.ip || 'unknown');
  if (!gate.allowed) return withCors(tooManyRequests(gate.retryAfter));

  try {
    const server = buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return withCors(await transport.handleRequest(req));
  } catch (err) {
    console.error('mcp request failed', err);
    return withCors(error(500, 'internal_error', 'The MCP request failed unexpectedly.'));
  }
};

export const config = {
  path: ['/mcp', '/api/v1/mcp'],
  method: ['POST', 'GET', 'OPTIONS'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
