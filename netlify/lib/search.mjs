// Search engine for the portfolio content index (netlify/lib/search-index.mjs).
// Pure functions, no I/O: shared by the HTTP API, the MCP tool and the tests.
//
// Ranking: BM25 over each document's title (weighted ×3) and text, with light stemming,
// a small synonym list, a boost when the query names a content type ("projects", "skills"…)
// and a bonus for exact phrase matches.

export const TYPES = ['about', 'services', 'skills', 'experience', 'projects', 'education', 'blog', 'contact'];

export const LIMITS = Object.freeze({
  maxQueryLength: 200,
  maxTerms: 16,
  defaultLimit: 5,
  maxLimit: 20,
  maxPerArticle: 2, // at most this many sections from one blog article, so results stay varied
  minRelativeScore: 0.25, // drop weak matches scoring under 25% of the best result
});

const STOP = new Set(
  'a an and are as at be but by can could do does for from had has have he her his how i if in into is it its me my of on or our she so than that the their them then there these they this to us was we were what when where which who why will with would you your tell show list give find search please'.split(' '),
);

// Words that signal the visitor wants a whole category (stemmed keys).
const TYPE_WORDS = {
  about: 'about', background: 'about', bio: 'about', profile: 'about', summary: 'about',
  service: 'services', offer: 'services', hire: 'services',
  skill: 'skills', technology: 'skills', tech: 'skills', stack: 'skills', tool: 'skills',
  experience: 'experience', job: 'experience', career: 'experience', employment: 'experience', employer: 'experience',
  project: 'projects', portfolio: 'projects', case: 'projects', client: 'projects',
  education: 'education', degree: 'education', university: 'education', certification: 'education', certificate: 'education', diploma: 'education', study: 'education',
  blog: 'blog', article: 'blog', guide: 'blog', post: 'blog',
  contact: 'contact', email: 'contact', phone: 'contact', whatsapp: 'contact', linkedin: 'contact', github: 'contact', reach: 'contact',
};

// Query expansion (stemmed keys → extra terms searched at half weight).
const SYNONYMS = {
  project: ['portfolio', 'website', 'platform'],
  portfolio: ['project'],
  skill: ['technology', 'tool', 'stack'],
  technology: ['skill', 'stack', 'tool'],
  tech: ['technology', 'skill', 'stack'],
  experience: ['work', 'developer', 'company'],
  job: ['experience', 'developer'],
  career: ['experience', 'developer', 'job'],
  education: ['degree', 'diploma', 'university', 'certification'],
  degree: ['education', 'diploma'],
  contact: ['email', 'phone', 'whatsapp'],
  hire: ['contact', 'service', 'freelancer'],
  blog: ['article', 'guide'],
  article: ['guide', 'blog'],
  guide: ['article'],
  service: ['development', 'design'],
  app: ['application', 'web'],
  website: ['site', 'web'],
  ecommerce: ['commerce', 'shop', 'store'],
  shop: ['store', 'ecommerce'],
  seo: ['search', 'ranking', 'google'],
};

/** Lower-case, strip accents and turn "Next.js" / "UI/UX" into searchable tokens. */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b([a-z0-9]+)\.js\b/g, '$1js') // next.js → nextjs, node.js → nodejs
    .replace(/e-commerce/g, 'ecommerce');
}

export function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && /(ss|sh|ch|x)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
  if (t.length > 6 && t.endsWith('ing')) return t.slice(0, -3);
  return t;
}

/** Text → array of stemmed tokens (stop words removed unless that would leave nothing). */
export function tokenize(text, { keepStopWords = false } = {}) {
  const raw = normalize(text).split(/[^a-z0-9+#]+/).filter(Boolean);
  const kept = keepStopWords ? raw : raw.filter((t) => !STOP.has(t));
  return (kept.length ? kept : raw).map(stem);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const err = (code, message) => ({ ok: false, error: { code, message } });

/**
 * Validates search parameters (URLSearchParams or a plain object).
 * Returns { ok: true, value: { query, limit, types } } or { ok: false, error }.
 */
export function parseSearchParams(params) {
  const get = (k) => (params instanceof URLSearchParams ? params.get(k) : params?.[k]);

  let q = get('q') ?? get('query');
  if (q == null || String(q).trim() === '') return err('missing_query', 'Provide a search query with ?q=, for example ?q=projects');
  q = String(q).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length > LIMITS.maxQueryLength) return err('query_too_long', `The query must be at most ${LIMITS.maxQueryLength} characters.`);
  if (!/[\p{L}\p{N}]/u.test(q)) return err('invalid_query', 'The query must contain at least one letter or number.');

  let limit = LIMITS.defaultLimit;
  const rawLimit = get('limit');
  if (rawLimit != null && rawLimit !== '') {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.maxLimit) {
      return err('invalid_limit', `limit must be a whole number from 1 to ${LIMITS.maxLimit}.`);
    }
  }

  let types = null;
  const rawType = get('type');
  if (rawType != null && rawType !== '') {
    types = (Array.isArray(rawType) ? rawType : String(rawType).split(',')).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    const unknown = types.filter((t) => !TYPES.includes(t));
    if (unknown.length) return err('invalid_type', `Unknown type "${unknown[0]}". Allowed: ${TYPES.join(', ')}.`);
    types = [...new Set(types)];
  }

  return { ok: true, value: { query: q, limit, types } };
}

// ---------------------------------------------------------------------------
// Index preparation (done once per warm function instance)
// ---------------------------------------------------------------------------

const prepared = new WeakMap();

function prepare(index) {
  if (prepared.has(index)) return prepared.get(index);
  const docs = index.documents.map((d) => {
    const titleTokens = tokenize(`${d.title} ${d.page_title}`, { keepStopWords: false });
    const textTokens = tokenize(d.text);
    const tf = new Map();
    for (const t of titleTokens) tf.set(t, (tf.get(t) || 0) + 3);
    for (const t of textTokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { doc: d, tf, length: titleTokens.length * 3 + textTokens.length, lower: normalize(`${d.title} ${d.text}`) };
  });
  const df = new Map();
  for (const p of docs) for (const t of p.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLength = docs.reduce((s, p) => s + p.length, 0) / Math.max(docs.length, 1);
  const value = { docs, df, avgLength, n: docs.length };
  prepared.set(index, value);
  return value;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const K1 = 1.2, B = 0.75;

function excerptFor(text, terms, max = 300) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return '';
  const hits = (s) => tokenize(s, { keepStopWords: true }).filter((t) => terms.has(t)).length;
  let best = 0, bestHits = -1;
  sentences.forEach((s, i) => { const h = hits(s); if (h > bestHits) { best = i; bestHits = h; } });
  let out = sentences[best];
  let next = best + 1;
  // keep adding the following sentences until the excerpt says something useful
  while (out.length < 160 && next < sentences.length) out += ' ' + sentences[next++];
  if (best > 0) out = '… ' + out;
  if (out.length > max) out = out.slice(0, max - 1).replace(/\s+\S*$/, '') + ' …';
  else if (next < sentences.length) out += ' …';
  return out;
}

/**
 * @param {object} index  the content index ({ documents: [...] , ... })
 * @param {{query: string, limit?: number, types?: string[]|null}} options
 */
export function search(index, { query, limit = LIMITS.defaultLimit, types = null }) {
  const { docs, df, avgLength, n } = prepare(index);

  const base = [...new Set(tokenize(query).slice(0, LIMITS.maxTerms))];
  const weights = new Map(base.map((t) => [t, 1]));
  for (const t of base) for (const s of SYNONYMS[t] || []) { const st = stem(s); if (!weights.has(st)) weights.set(st, 0.5); }
  const intents = new Set(base.map((t) => TYPE_WORDS[t]).filter(Boolean));
  const phrase = base.length > 1 ? normalize(query).replace(/[^a-z0-9+#]+/g, ' ').trim() : null;

  const scored = [];
  for (const p of docs) {
    if (types && !types.includes(p.doc.type)) continue;
    let score = 0;
    const matched = [];
    for (const [t, w] of weights) {
      const f = p.tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (n - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score += w * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * p.length) / avgLength)));
      if (w === 1) matched.push(t);
    }
    if (intents.has(p.doc.type)) score += 2.5;
    if (phrase && p.lower.replace(/[^a-z0-9+#]+/g, ' ').includes(phrase)) score += 2;
    if (score > 0 && (matched.length || intents.has(p.doc.type))) scored.push({ p, score, matched });
  }

  scored.sort((a, b) => b.score - a.score);
  const floor = scored.length ? scored[0].score * LIMITS.minRelativeScore : 0;
  const relevant = scored.filter((s) => s.score >= floor);

  const perArticle = new Map();
  const results = [];
  for (const s of relevant) {
    // Long articles have many sections; cap them so one post can't fill every result.
    // Portfolio pages (projects, services, …) list separate items, so they aren't capped.
    if (s.p.doc.type === 'blog') {
      const page = s.p.doc.url.split('#')[0];
      if ((perArticle.get(page) || 0) >= LIMITS.maxPerArticle) continue;
      perArticle.set(page, (perArticle.get(page) || 0) + 1);
    }
    const d = s.p.doc;
    results.push({
      id: d.id,
      type: d.type,
      title: d.title,
      page_title: d.page_title,
      url: d.url,
      excerpt: excerptFor(d.text, new Set(s.matched.length ? s.matched : base)),
      score: Math.round(s.score * 1000) / 1000,
      matched_terms: s.matched,
      ...(d.links?.length ? { links: d.links } : {}),
    });
    if (results.length >= limit) break;
  }

  return {
    query,
    limit,
    types: types || TYPES,
    total_matches: relevant.length,
    count: results.length,
    results,
  };
}
