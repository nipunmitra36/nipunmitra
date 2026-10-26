# Nipun Mitra — Portfolio

Static portfolio + blog. `index.html` opens directly in a browser for previewing the home page; the production site (with the blog) is generated into `dist/`.

## Build

```bash
npm install
npm run build -- https://your-domain.com   # writes dist/
npm run preview                            # serves dist/ locally
```

On **Vercel** and **Netlify** the site URL is detected automatically (`vercel.json` / `netlify.toml` are included) — just connect the repo. Anywhere else, pass the URL as above or set `SITE_URL`.

The build fills in canonical / Open Graph / structured-data URLs, compiles Tailwind to a small CSS file, renders the blog to static HTML and writes `robots.txt`, `sitemap.xml` and `blog/rss.xml`.

## Adding a blog post

1. Add an entry to `blog/posts.mjs` (one primary keyword per post; every `<h2>` needs an `id`).
2. Create its share image `images/blog/<slug>.jpg` (1200×630) — `tools/og-post.html?kicker=...&title=...` renders one.
3. Rebuild.

After going live, submit `https://your-domain.com/sitemap.xml` in Google Search Console.
"# nipunmitra" 
