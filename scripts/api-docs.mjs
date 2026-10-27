// Machine-readable API descriptions, written to dist/api/v1/ by the build:
//   openapi.json       — OpenAPI 3.1 (importable as e.g. a ChatGPT GPT Action or by agent frameworks)
//   openai-tools.json  — OpenAI function-calling tool definitions (Chat Completions + Responses API formats)

import { TYPES, LIMITS } from '../netlify/lib/search.mjs';

const TOOL_NAME = 'search_nipun_mitra_portfolio';
const TOOL_DESCRIPTION =
  "Search the public portfolio website of Nipun Mitra, a software developer in Dhaka, Bangladesh. " +
  'Covers his background, skills and technologies, services, work experience, projects, education, ' +
  'blog articles and public contact links. Returns matching sections with page titles, original URLs and text excerpts. ' +
  'Call it with the user’s question or a few keywords, then answer from the returned excerpts and cite the URLs.';

const parameters = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: LIMITS.maxQueryLength, description: 'What to look for, e.g. "projects", "Laravel experience", "contact email".' },
    limit: { type: 'integer', minimum: 1, maximum: LIMITS.maxLimit, description: `Maximum number of results (default ${LIMITS.defaultLimit}).` },
    type: { type: 'array', items: { type: 'string', enum: TYPES }, description: 'Optional: only return these content types.' },
  },
  required: ['query'],
  additionalProperties: false,
};

export function openAiTools(siteUrl) {
  return {
    description: `Tool definitions for calling ${siteUrl}/api/v1/search from OpenAI function calling. Your code runs the HTTP request when the model calls the tool.`,
    endpoint: {
      method: 'GET',
      url: `${siteUrl}/api/v1/search`,
      query_mapping: { query: 'q', limit: 'limit', type: 'type (comma-separated)' },
      example: `${siteUrl}/api/v1/search?q=projects&limit=5`,
    },
    chat_completions: [{ type: 'function', function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters } }],
    responses: [{ type: 'function', name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters }],
    mcp: { url: `${siteUrl}/mcp`, transport: 'streamable-http', tool: 'search_portfolio' },
  };
}

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code', 'message'] }, api_version: { type: 'string' } },
};

export function openApi(siteUrl) {
  const result = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Stable identifier of the matched section.' },
      type: { type: 'string', enum: TYPES },
      title: { type: 'string', description: 'Heading of the matched section.' },
      page_title: { type: 'string', description: 'Title of the page the section is on.' },
      url: { type: 'string', format: 'uri', description: 'Original URL of the page/section on the website.' },
      excerpt: { type: 'string', description: 'Relevant text from the section.' },
      score: { type: 'number' },
      matched_terms: { type: 'array', items: { type: 'string' }, description: 'Query terms (stemmed) found in the section.' },
      links: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } }, description: 'Public links in the section (live project sites, contact links, related guides).' },
    },
    required: ['id', 'type', 'title', 'page_title', 'url', 'excerpt', 'score'],
  };
  return {
    openapi: '3.1.0',
    info: {
      title: 'Nipun Mitra portfolio search API',
      version: '1.0.0',
      description:
        'Read-only search over the public content of Nipun Mitra’s portfolio website (about, skills, services, experience, projects, education, blog, contact links). ' +
        'The index is rebuilt from the published pages on every deploy. Rate limited; responses are cached for up to an hour.',
    },
    servers: [{ url: siteUrl }],
    paths: {
      '/api/v1/search': {
        get: {
          operationId: 'searchPortfolio',
          summary: 'Search the portfolio content',
          description: TOOL_DESCRIPTION,
          parameters: [
            { name: 'q', in: 'query', required: true, description: parameters.properties.query.description, schema: { type: 'string', minLength: 1, maxLength: LIMITS.maxQueryLength } },
            { name: 'limit', in: 'query', required: false, description: parameters.properties.limit.description, schema: { type: 'integer', minimum: 1, maximum: LIMITS.maxLimit, default: LIMITS.defaultLimit } },
            { name: 'type', in: 'query', required: false, description: `Comma-separated content types: ${TYPES.join(', ')}.`, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Search results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      api_version: { type: 'string' },
                      query: { type: 'string' },
                      limit: { type: 'integer' },
                      types: { type: 'array', items: { type: 'string' } },
                      total_matches: { type: 'integer' },
                      count: { type: 'integer' },
                      results: { type: 'array', items: result },
                      source: { type: 'object', properties: { site: { type: 'string' }, index_generated_at: { type: 'string', format: 'date-time' }, document_count: { type: 'integer' } } },
                    },
                    required: ['query', 'count', 'results'],
                  },
                },
              },
            },
            400: { description: 'Invalid input (missing or too-long query, bad limit or type)', content: { 'application/json': { schema: errorSchema } } },
            405: { description: 'Method not allowed', content: { 'application/json': { schema: errorSchema } } },
            429: { description: 'Rate limited — see the Retry-After header', content: { 'application/json': { schema: errorSchema } } },
          },
        },
      },
      '/api/v1/health': {
        get: {
          operationId: 'health',
          summary: 'API status and content-index information',
          responses: { 200: { description: 'The API is up', content: { 'application/json': { schema: { type: 'object' } } } } },
        },
      },
    },
  };
}
