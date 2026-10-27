// Response helpers shared by the API functions.
// The API is public and read-only, so any origin may call it (CORS *), but only with GET.

export const API_VERSION = '1';

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'X-Content-Type-Options': 'nosniff',
  // API responses are for programs, not search-engine result pages.
  'X-Robots-Tag': 'noindex',
};

// Search results only change when the site is redeployed (each deploy refreshes Netlify's cache),
// so successful responses are cached on the CDN. Repeated identical queries then never reach the
// function, which keeps usage low and absorbs most abusive traffic.
export const CACHE_SUCCESS = {
  'Cache-Control': 'public, max-age=300',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=86400',
};
export const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function error(status, code, message, headers = {}) {
  return json({ error: { code, message }, api_version: API_VERSION }, status, { ...NO_STORE, ...headers });
}

export const preflight = () => new Response(null, { status: 204, headers: { ...BASE_HEADERS, 'Access-Control-Max-Age': '86400' } });

export const methodNotAllowed = (allowed = 'GET, OPTIONS') =>
  error(405, 'method_not_allowed', `Use ${allowed.split(',')[0]} for this endpoint.`, { Allow: allowed });

export const tooManyRequests = (retryAfterSeconds) =>
  error(429, 'rate_limited', 'Too many requests. Please slow down and try again shortly.', { 'Retry-After': String(retryAfterSeconds) });
