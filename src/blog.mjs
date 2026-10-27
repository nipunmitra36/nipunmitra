// Blog index and article pages. Rendered to plain HTML by scripts/generate.mjs,
// so search engines get the full content without running JavaScript.

import { SITE, WA, esc, person, breadcrumbs, canonicalFor, eagerFirst } from './layout.mjs';

const formatDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const wordCount = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
export const readingTime = (html) => Math.max(1, Math.round(wordCount(html) / 220));

const toc = (html) =>
  [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(([, id, text]) => ({ id, text: text.replace(/<[^>]+>/g, '') }));

// Article card. `base` is the path back to the site root from the page the card appears on.
export function postCard(p, base, headingTag = 'h2') {
  return `
          <article class="reveal glass glow-border group relative flex flex-col overflow-hidden rounded-3xl transition duration-500 hover:-translate-y-1">
            <a href="${base}blog/${p.slug}.html" class="absolute inset-0 z-10" aria-label="${esc(p.title)}"></a>
            <div class="aspect-[1200/630] overflow-hidden">
              <img sizes="(min-width: 1024px) 368px, (min-width: 640px) calc(50vw - 28px), calc(100vw - 32px)" src="${base}images/blog/${p.slug}.jpg" alt="" width="1200" height="630" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            </div>
            <div class="flex flex-1 flex-col p-6">
              <p class="text-xs font-semibold uppercase tracking-widest text-nebula-cyan">${esc(p.category)}</p>
              <${headingTag} class="mt-2 font-heading text-lg font-bold leading-snug text-white">${esc(p.title)}</${headingTag}>
              <p class="mt-3 flex-1 text-sm leading-relaxed text-slate-400">${esc(p.excerpt)}</p>
              <p class="mt-5 flex items-center gap-3 text-xs text-slate-400">
                <time datetime="${p.date}">${formatDate(p.date)}</time><span aria-hidden="true">·</span><span>${readingTime(p.html)} min read</span>
              </p>
            </div>
          </article>`;
}

const crumbs = (base, items) => `
        <nav aria-label="Breadcrumb" class="mb-6 text-sm text-slate-400">
          <ol class="flex flex-wrap items-center gap-2">
            ${items.map(([label, href], i) => (i < items.length - 1
              ? `<li><a href="${base}${href}" class="hover:text-white">${esc(label)}</a></li><li aria-hidden="true">/</li>`
              : `<li class="text-slate-300" aria-current="page">${esc(label)}</li>`)).join('\n            ')}
          </ol>
        </nav>`;

export function blogIndexPage(posts) {
  const file = 'blog.html';
  const description =
    'Practical guides on custom software, web and app development, UI/UX, SEO, selling online, tech trends and developer careers — by software developer Nipun Mitra.';
  return {
    file,
    active: 'blog',
    title: 'Blog: Web Development Guides | Nipun Mitra',
    description,
    jsonLd: {
      '@graph': [
        {
          '@type': 'Blog',
          '@id': `${canonicalFor(file)}#blog`,
          url: canonicalFor(file),
          name: 'Nipun Mitra — Web Development Blog',
          description,
          inLanguage: 'en',
          author: person(),
          publisher: person(),
          dateModified: '{{BUILD_DATE}}',
          blogPost: posts.map((p) => ({
            '@type': 'BlogPosting',
            '@id': `${canonicalFor(`blog/${p.slug}.html`)}#article`,
            headline: p.title,
            url: canonicalFor(`blog/${p.slug}.html`),
            datePublished: p.date,
            image: `${SITE}/images/blog/${p.slug}.jpg`,
            author: person(),
          })),
        },
        breadcrumbs([['Home', 'index.html'], ['Blog', file]]),
      ],
    },
    main: `
    <section class="px-4 pb-24 pt-36">
      <div class="mx-auto max-w-6xl">${crumbs('', [['Home', 'index.html'], ['Blog']])}
        <p class="font-mono text-sm text-nebula-cyan">Blog</p>
        <h1 class="mt-3 font-display text-4xl font-black leading-tight text-white sm:text-6xl">Web development <span class="text-gradient">guides</span></h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">Practical, no-nonsense articles on custom software, web and app development, UI/UX design, SEO, selling online, tech trends and building a developer career.</p>

        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${eagerFirst(posts.map((p) => postCard(p, '')).join(''))}
        </div>
      </div>
    </section>`,
  };
}

export function postPage(post, posts) {
  const file = `blog/${post.slug}.html`;
  const base = '../';
  const canonical = canonicalFor(file);
  const image = `${SITE}/images/blog/${post.slug}.jpg`;
  const words = wordCount(post.html);
  const minutes = readingTime(post.html);
  const sections = toc(post.html);
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  // Keep the brand suffix only when the title still fits in Google's ~60 characters.
  const title = `${post.metaTitle} | Nipun Mitra`.length <= 60 ? `${post.metaTitle} | Nipun Mitra` : post.metaTitle;

  const extraMeta = [
    `  <meta property="article:published_time" content="${post.date}T00:00:00Z" />`,
    `  <meta property="article:modified_time" content="{{BUILD_DATE}}T00:00:00Z" />`,
    `  <meta property="article:author" content="${SITE}/about.html" />`,
    `  <meta property="article:section" content="${esc(post.category)}" />`,
    ...post.tags.map((t) => `  <meta property="article:tag" content="${esc(t)}" />`),
  ].join('\n');

  return {
    file,
    active: 'blog',
    title,
    description: post.description,
    ogType: 'article',
    ogImage: `images/blog/${post.slug}.jpg`,
    ogImageAlt: post.title,
    extraMeta,
    jsonLd: {
      '@graph': [
        {
          '@type': 'BlogPosting',
          '@id': `${canonical}#article`,
          headline: post.title,
          description: post.description,
          url: canonical,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
          datePublished: post.date,
          dateModified: '{{BUILD_DATE}}',
          author: { '@type': 'Person', '@id': `${SITE}/#person`, name: 'Nipun Mitra', url: `${SITE}/about.html`, jobTitle: 'Software Developer' },
          publisher: person(),
          isPartOf: { '@id': `${canonicalFor('blog.html')}#blog` },
          articleSection: post.category,
          keywords: [post.keyword, ...post.tags].join(', '),
          wordCount: words,
          timeRequired: `PT${minutes}M`,
          inLanguage: 'en',
        },
        breadcrumbs([['Home', 'index.html'], ['Blog', 'blog.html'], [post.title, file]]),
        {
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
      ],
    },
    main: `
    <article class="px-4 pb-24 pt-36">
      <div class="mx-auto max-w-6xl">${crumbs(base, [['Home', 'index.html'], ['Blog', 'blog.html'], [post.category]])}

        <header class="max-w-4xl">
          <p class="text-xs font-semibold uppercase tracking-widest text-nebula-cyan">${esc(post.category)}</p>
          <h1 class="mt-3 font-display text-3xl font-black leading-tight text-white sm:text-5xl">${esc(post.title)}</h1>
          <p class="mt-5 text-lg leading-relaxed text-slate-400">${esc(post.description)}</p>
          <div class="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span class="flex items-center gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display text-xs font-bold text-white">NM</span>
              <a href="${base}about.html" rel="author" class="text-white hover:text-nebula-cyan">Nipun Mitra</a>
            </span>
            <span aria-hidden="true">·</span><time datetime="${post.date}">${formatDate(post.date)}</time>
            <span aria-hidden="true">·</span><span>${minutes} min read</span>
          </div>
        </header>

        <figure class="mt-10 overflow-hidden rounded-3xl border border-white/10">
          <img sizes="(min-width: 1200px) 1152px, calc(100vw - 32px)" src="${base}images/blog/${post.slug}.jpg" alt="Cover image for the article: ${esc(post.title)}" width="1200" height="630" fetchpriority="high" class="w-full" />
        </figure>

        <div class="mt-14 grid gap-12 lg:grid-cols-[1fr_260px]">
          <div class="min-w-0">
            <div class="prose-space">${post.html}</div>

            <section aria-labelledby="faq" class="mt-14">
              <h2 id="faq" class="font-display text-2xl font-bold text-white">Frequently asked questions</h2>
              <div class="mt-6 space-y-3">
                ${post.faq.map((f) => `<details class="faq glass rounded-2xl px-6 py-4">
                  <summary class="cursor-pointer list-none font-semibold text-white">${esc(f.q)}</summary>
                  <p class="mt-3 leading-relaxed text-slate-400">${esc(f.a)}</p>
                </details>`).join('\n                ')}
              </div>
            </section>

            <aside class="glass relative mt-14 overflow-hidden rounded-3xl p-8" data-search-ignore>
              <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-nebula-violet/25 blur-3xl"></div>
              <p class="relative font-display text-2xl font-bold text-white">Need help with ${esc(post.keyword)}?</p>
              <p class="relative mt-3 max-w-xl text-slate-400">Tell me about your project and I'll suggest the simplest way to build it well — no obligation.</p>
              <a href="${WA}" target="_blank" rel="noopener" class="relative mt-6 mr-3 inline-flex items-center gap-3 rounded-full bg-[#25D366] px-7 py-3.5 font-semibold text-[#052e16] transition duration-300 hover:shadow-[0_0_40px_rgba(37,211,102,.45)]"><i class="fa-brands fa-whatsapp text-lg"></i> WhatsApp</a>
              <a href="${base}contact.html" class="relative mt-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-nebula-violet to-nebula-cyan px-7 py-3.5 font-semibold text-white transition duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,.5)]">Get in touch <i class="fa-solid fa-arrow-right text-sm"></i></a>
            </aside>

            <div class="mt-10 flex items-start gap-4 rounded-3xl border border-white/10 p-6" data-search-ignore>
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display font-bold text-white">NM</span>
              <div>
                <p class="font-semibold text-white">Written by <a href="${base}about.html" class="hover:text-nebula-cyan">Nipun Mitra</a></p>
                <p class="mt-1 text-sm leading-relaxed text-slate-400">Software developer in Dhaka with 3+ years of experience building websites and web apps with React, Next.js, TypeScript, Laravel and WordPress.</p>
              </div>
            </div>
          </div>

          <aside class="hidden lg:block">
            <nav aria-label="Table of contents" class="glass sticky top-28 rounded-2xl p-5">
              <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-white">On this page</p>
              <ol class="space-y-2 text-sm">
                ${sections.map((s) => `<li><a href="#${s.id}" class="block text-slate-400 transition hover:text-white">${esc(s.text)}</a></li>`).join('\n                ')}
                <li><a href="#faq" class="block text-slate-400 transition hover:text-white">FAQ</a></li>
              </ol>
            </nav>
          </aside>
        </div>
      </div>
    </article>

    <section aria-labelledby="related" class="px-4 pb-24" data-search-ignore>
      <div class="mx-auto max-w-6xl">
        <h2 id="related" class="font-display text-2xl font-bold text-white sm:text-3xl">Keep reading</h2>
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${related.map((p) => postCard(p, base, 'h3')).join('')}
        </div>
      </div>
    </section>`,
  };
}
