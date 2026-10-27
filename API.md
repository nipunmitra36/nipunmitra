# Portfolio search API

A read-only API that lets AI applications (and anything else that speaks HTTP) search the **public content of
https://nipunmitra.netlify.app** — about, skills, services, work experience, projects, education, blog articles
and public contact links.

| Endpoint | Method | What it does |
|---|---|---|
| `/api/v1/search?q=…` | GET | Search the site's content; returns JSON results with titles, original URLs and excerpts |
| `/api/v1/health` | GET | Status, plus when the content index was built and how many sections it holds |
| `/mcp` (also `/api/v1/mcp`) | POST | [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless) with one tool, `search_portfolio` |
| `/api/v1/openapi.json` | GET | OpenAPI 3.1 description (static file) |
| `/api/v1/openai-tools.json` | GET | Ready-made OpenAI function-calling tool definitions (static file) |

> **Discovery:** nothing here makes AI platforms find this API automatically. The site's `llms.txt` lists it,
> but an AI app only uses the API when its developer (or user) configures it — see [Using it from AI apps](#using-it-from-ai-apps).

---

## How it works

```
src/ (pages, sections, posts)  ──npm run build──▶  generated pages (index.html, blog/*.html …)
                                                        │
                       scripts/search-index.mjs ◀───────┘  splits every page into sections
                                │
                                ▼
               netlify/lib/search-index.mjs   (content index, rebuilt on every deploy)
                                │
       netlify/functions/search.mjs · health.mjs · mcp.mjs   (Netlify Functions)
```

- **Real content, no database.** The index is built at deploy time from the same HTML pages visitors see, so
  results always match the live website. The content is small (≈130 sections) and only changes when the site is
  redeployed, so a database would add cost and moving parts without any benefit.
- **Search:** BM25 relevance ranking over section titles and text, light stemming ("projects" ↔ "project"),
  a few synonyms ("hire" → contact, "tech" → skills), a boost when the query names a content type, and excerpts
  taken from the sentences that matched.
- **What is indexed:** each page's main content, split at its headings; each project card, service and job is its
  own result. **Not indexed:** navigation, footer, the contact form, call-to-action bands, the "keep reading" lists,
  and the third-party reference on the Education page. There are no API keys or secrets anywhere in the API.

### Files

| File | Purpose |
|---|---|
| `netlify/functions/search.mjs` | `GET /api/v1/search` |
| `netlify/functions/health.mjs` | `GET /api/v1/health` |
| `netlify/functions/mcp.mjs` | MCP server at `/mcp` |
| `netlify/lib/search.mjs` | Search engine + input validation (shared) |
| `netlify/lib/http.mjs`, `netlify/lib/rate-limit.mjs` | Response helpers, CORS, caching, per-instance rate limiter |
| `netlify/lib/search-index.mjs` | **Generated** content index (git-ignored; rebuilt by `npm run build` / `npm run index`) |
| `scripts/search-index.mjs` | Builds the index from the generated pages |
| `scripts/api-docs.mjs` | Generates `openapi.json` and `openai-tools.json` |
| `scripts/serve-local.mjs` | Local server: site + API without a Netlify account |
| `tests/*.test.mjs` | Tests (`npm test`) |

---

## `GET /api/v1/search`

| Parameter | Required | Rules |
|---|---|---|
| `q` | yes | 1–200 characters, must contain a letter or number |
| `limit` | no | whole number 1–20 (default 5) |
| `type` | no | comma-separated: `about, services, skills, experience, projects, education, blog, contact` |

### Example request

```bash
curl "https://nipunmitra.netlify.app/api/v1/search?q=projects&limit=2"
```

### Example response

Actual, unedited output of the `search` function, run locally against an index built for
`https://nipunmitra.netlify.app` (the live site returns the same data; only the timestamp differs per deploy):

```json
{
  "api_version": "1",
  "query": "projects",
  "limit": 2,
  "types": ["about", "services", "skills", "experience", "projects", "education", "blog", "contact"],
  "total_matches": 15,
  "count": 2,
  "results": [
    {
      "id": "projects#idesk360",
      "type": "projects",
      "title": "iDesk360",
      "page_title": "Projects & Portfolio | Nipun Mitra, Software Developer",
      "url": "https://nipunmitra.netlify.app/projects.html#idesk360",
      "excerpt": "SaaS Helpdesk Platform iDesk360 SaaS helpdesk platform built with Next.js and TypeScript. Next.js TypeScript Tailwind idesk360.com",
      "score": 9.175,
      "matched_terms": ["project"],
      "links": [{ "label": "iDesk360 (live site)", "url": "https://idesk360.com/" }]
    },
    {
      "id": "projects#cw-skills",
      "type": "projects",
      "title": "CW Skills",
      "page_title": "Projects & Portfolio | Nipun Mitra, Software Developer",
      "url": "https://nipunmitra.netlify.app/projects.html#cw-skills",
      "excerpt": "IT Training Platform CW Skills Professional IT training portal built with Next.js and Redux. Next.js TypeScript Tailwind Redux cwskills.com",
      "score": 8.649,
      "matched_terms": ["project"],
      "links": [{ "label": "CW Skills (live site)", "url": "https://cwskills.com/" }]
    }
  ],
  "source": {
    "site": "https://nipunmitra.netlify.app",
    "index_generated_at": "2026-10-27T04:46:03.400Z",
    "document_count": 129
  }
}
```

`matched_terms` are the stemmed query words found in that section (e.g. "booking" → `book`).

### More examples

```bash
curl "https://nipunmitra.netlify.app/api/v1/search?q=Laravel&limit=3"
curl "https://nipunmitra.netlify.app/api/v1/search?q=contact%20email"
curl "https://nipunmitra.netlify.app/api/v1/search?q=booking%20website&type=blog"
curl "https://nipunmitra.netlify.app/api/v1/search?q=degree&type=education"
```

### Errors

Errors are JSON with a stable `code`:

```json
{ "error": { "code": "invalid_type", "message": "Unknown type \"passwords\". Allowed: about, services, skills, experience, projects, education, blog, contact." }, "api_version": "1" }
```

| Status | `code` | When |
|---|---|---|
| 400 | `missing_query`, `invalid_query`, `query_too_long`, `invalid_limit`, `invalid_type` | Bad input |
| 405 | `method_not_allowed` | Anything other than GET/OPTIONS |
| 429 | `rate_limited` | Too many requests (see `Retry-After`) |
| 500 | `internal_error` | Unexpected failure (details are only logged, never returned) |

## `GET /api/v1/health`

Actual output from the same local run:

```json
{
  "status": "ok",
  "api_version": "1",
  "time": "2026-10-27T04:46:10.392Z",
  "index": {
    "site": "https://nipunmitra.netlify.app",
    "generated_at": "2026-10-27T04:46:03.400Z",
    "document_count": 129,
    "counts": { "about": 2, "services": 7, "skills": 3, "experience": 2, "projects": 10, "education": 4, "contact": 1, "blog": 100 }
  },
  "endpoints": { "search": "/api/v1/search?q=…", "health": "/api/v1/health", "mcp": "/mcp", "openapi": "/api/v1/openapi.json", "tools": "/api/v1/openai-tools.json" }
}
```

---

## Using it from AI apps

### OpenAI function calling

`https://nipunmitra.netlify.app/api/v1/openai-tools.json` contains the tool definition in both the Chat
Completions (`chat_completions`) and Responses API (`responses`) formats. The model decides when to call the tool;
**your code** performs the HTTP request and sends the JSON back. Python example (Chat Completions):

```python
import json, os, requests
from openai import OpenAI

API = "https://nipunmitra.netlify.app"
tools = requests.get(f"{API}/api/v1/openai-tools.json", timeout=10).json()["chat_completions"]
client = OpenAI()  # uses OPENAI_API_KEY
model = os.environ.get("OPENAI_MODEL", "gpt-4.1")  # any model that supports tool calling

messages = [{"role": "user", "content": "Which projects has Nipun Mitra built with Laravel?"}]
reply = client.chat.completions.create(model=model, messages=messages, tools=tools).choices[0].message

while reply.tool_calls:
    messages.append(reply)
    for call in reply.tool_calls:
        args = json.loads(call.function.arguments)
        params = {"q": args["query"], "limit": args.get("limit", 5)}
        if args.get("type"):
            params["type"] = ",".join(args["type"])
        result = requests.get(f"{API}/api/v1/search", params=params, timeout=10).json()
        messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})
    reply = client.chat.completions.create(model=model, messages=messages, tools=tools).choices[0].message

print(reply.content)
```

JavaScript (`fetch`) — the request your tool handler makes:

```js
const res = await fetch('https://nipunmitra.netlify.app/api/v1/search?' + new URLSearchParams({ q: 'Laravel', limit: '5' }));
const data = await res.json(); // { query, count, results: [{ title, url, excerpt, … }], … }
```

### ChatGPT custom GPTs (Actions) and other OpenAPI clients

Import `https://nipunmitra.netlify.app/api/v1/openapi.json` (no authentication needed).

### MCP clients (Claude, Cursor, VS Code, …)

Remote MCP server URL: `https://nipunmitra.netlify.app/mcp` (Streamable HTTP, no auth). Tool: `search_portfolio`
(`query`, optional `limit`, optional `type` array). For example, in Claude Code:

```bash
claude mcp add --transport http nipun-portfolio https://nipunmitra.netlify.app/mcp
```

Other clients that support remote/HTTP MCP servers take the same URL in their MCP settings. The server is stateless
and answers POST only (a GET returns 405, because serverless functions can't hold open an event stream).

---

## Verifying that results are real website content

1. `curl https://nipunmitra.netlify.app/api/v1/health` — `index.generated_at` should match your latest deploy time,
   and `index.site` your site URL.
2. Search for something specific to the site, e.g. `?q=Crystal Valet`, open the returned `url`, and check that the
   `excerpt` text appears on that page (cards link straight to their anchor, e.g. `projects.html#crystal-valet`).
3. Change some text on the site, redeploy, and search for the new wording — it's found after the deploy.
4. Search for nonsense (`?q=qwxzv`) — you get `"count": 0` and no made-up results.
5. Locally, `npm test` checks that every project card and blog article on the site is in the index (expected values
   are read from the source files), that excluded content is absent, and exercises the HTTP and MCP endpoints.

---

## Running locally

```bash
npm install
npm test                                     # 26 tests: index, search, HTTP API, MCP (official SDK client)

npm run build -- http://localhost:8888       # build site + index for local use
npm run serve:local                          # site + API on http://localhost:8888 (no Netlify account needed)
# or the official emulator:
npx netlify-cli dev --dir dist               # also http://localhost:8888
```

After editing content, `npm run build` (or `npm run generate && npm run index`) refreshes the index.

## Deploying on Netlify

The site already deploys from this repository with `npm run build` and `publish = "dist"` (see `netlify.toml`).
Nothing extra is needed:

1. Commit and push. Netlify runs the build, which generates the pages **and** `netlify/lib/search-index.mjs`
   (using Netlify's `URL` environment variable for absolute links), then bundles everything in
   `netlify/functions/` automatically.
2. In the Netlify UI, open **Logs & metrics → Functions**: you should see `search`, `health` and `mcp`.
3. Run the verification steps above against the live URL.

Alternatively, from your machine: `npx netlify-cli login`, `npx netlify-cli link`, then `npx netlify-cli deploy --build --prod`.

### Account setup, environment variables and costs

- **No new accounts, keys or environment variables.** The API uses no secrets. `SITE_URL` is only needed if you
  build outside Netlify (Netlify provides `URL`).
- **Costs:** function invocations count toward your Netlify plan's usage (see https://www.netlify.com/pricing/).
  Successful searches are cached on Netlify's CDN for up to an hour (and refreshed on every deploy), so repeated
  queries don't invoke the function again.
- **Rate limiting:** each of `search` and `mcp` sets a Netlify platform rate limit of 60 requests per minute per IP
  in its `config` (Free plans allow 2 such code-based rules per site — both are used). A second, in-memory limiter
  inside each function adds best-effort protection. Netlify notes enforcement can lag by up to ~10 seconds.

## Limitations

- Keyword relevance search, not semantic/vector search: it matches words (with stemming and a few synonyms), so
  very different phrasings may miss. The calling AI model usually compensates by trying other keywords.
- Content is as fresh as the latest deploy; responses may be served from the CDN cache for up to an hour within a deploy.
- English-only stemming.
- The in-function limiter is per instance (it resets on cold starts); the platform rule is the real limit.
- The MCP endpoint is public and unauthenticated by design (public, read-only data).
- AI platforms don't discover the API on their own; it has to be configured as shown above.
