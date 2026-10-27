# Nipun Mitra — Portfolio

A multi-page static site: Home, About, Services, Skills, Experience, Projects, Education, Blog (with articles) and Contact.

## Preview

Open `index.html` (or any other `.html` page) straight in the browser — every page and menu link works without a build.

## Editing

The `.html` pages are **generated** — edit the sources, then run `npm run generate`:

| What | Where |
|---|---|
| Menu, footer, `<head>`/SEO tags, page shell | `src/layout.mjs` |
| Page titles, descriptions, structured data | `src/pages.mjs` |
| Section content (hero, about, skills, …) | `src/sections/*.html` |
| Blog articles | `src/posts.mjs` (+ share image in `images/blog/<slug>.jpg`) |
| Styles / scripts / Tailwind theme | `assets/site.css`, `assets/main.js`, `assets/tailwind.config.js` |
| Images | add/replace the original, then `npm run images` (makes the WebP sizes in `images/opt/`) and `npm run generate` |

Performance notes: images are served as responsive WebP (`srcset`/`sizes`), fonts and icons are self-hosted,
all CSS is inlined by the build, Font Awesome is trimmed to the icons actually used, and the build writes
cache headers for Vercel (`vercel.json`), Netlify/Cloudflare Pages (`_headers`) and Apache/cPanel (`.htaccess`).

## Deploy

```bash
npm install
npm run build -- https://your-domain.com   # writes dist/
npm run preview                            # serves dist/ locally
```

On **Vercel** and **Netlify** the site URL is detected automatically (`vercel.json` / `netlify.toml` are included) — just connect the repo. The build fills in canonical / Open Graph / structured-data URLs, compiles Tailwind, and writes `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and `blog/rss.xml` with the real domain.

The contact form sends through [FormSubmit](https://formsubmit.co) to nipunmitra03@gmail.com. The very first message triggers an activation email to that inbox — click the link once and every later message arrives normally.

After going live, submit `https://your-domain.com/sitemap.xml` in Google Search Console.

## Search API for AI agents

The site includes a read-only search API (Netlify Functions) over its public content:
`/api/v1/search?q=…`, `/api/v1/health`, an MCP server at `/mcp`, plus OpenAPI and OpenAI tool definitions.
See **[API.md](API.md)** for usage, examples, verification and deployment. Run the tests with `npm test`.
