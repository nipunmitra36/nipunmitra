// Server-side templates for the blog. build.mjs calls renderIndex() and renderPost()
// and writes plain HTML, so search engines get the full content without running JS.

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const wordCount = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
export const readingTime = (html) => Math.max(1, Math.round(wordCount(html) / 220));

const toc = (html) =>
  [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(([, id, text]) => ({ id, text: text.replace(/<[^>]+>/g, '') }));

function head({ site, css, title, description, canonical, image, imageAlt, type, extraMeta = '', jsonLd }) {
  return `<!doctype html>
<html lang="en" dir="ltr" class="no-js">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>document.documentElement.classList.replace('no-js', 'js');</script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="author" content="Nipun Mitra" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${canonical}" />
  <meta name="theme-color" content="#04050d" />
  <meta name="color-scheme" content="dark" />

  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Nipun Mitra" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(imageAlt)}" />
${extraMeta}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${esc(imageAlt)}" />

  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="alternate" type="application/rss+xml" title="Nipun Mitra — Blog" href="${site}/blog/rss.xml" />

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" /></noscript>
  <link rel="stylesheet" href="/${css.tailwind}" />
  <link rel="stylesheet" href="/${css.blog}" />
</head>`;
}

const header = `
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-void">Skip to content</a>
  <header class="fixed inset-x-0 top-4 z-50 px-4">
    <nav aria-label="Primary" class="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 sm:px-6">
      <a href="/" class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display text-sm font-bold text-white">NM</span>
        <span class="hidden font-display text-sm tracking-widest text-white sm:block">Nipun Mitra</span>
      </a>
      <ul class="flex items-center gap-1 text-sm">
        <li class="hidden md:block"><a href="/#services" class="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">Services</a></li>
        <li class="hidden md:block"><a href="/#projects" class="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">Projects</a></li>
        <li><a href="/blog/" class="rounded-full bg-white/10 px-4 py-2 text-white">Blog</a></li>
      </ul>
      <a href="/#contact" class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-void transition hover:bg-nebula-cyan sm:px-5">
        Let's talk <i class="fa-solid fa-arrow-right text-xs"></i>
      </a>
    </nav>
  </header>`;

function footer(posts) {
  return `
  <footer class="relative z-10 border-t border-white/5 px-4 py-12">
    <div class="mx-auto grid max-w-6xl gap-10 text-sm text-slate-400 md:grid-cols-3">
      <div>
        <a href="/" class="font-display text-white">Nipun Mitra</a>
        <p class="mt-3 leading-relaxed">Software developer in Dhaka, Bangladesh, building custom software, web apps and fast, SEO-friendly websites.</p>
      </div>
      <nav aria-label="Guides">
        <p class="mb-3 font-semibold uppercase tracking-widest text-white">Guides</p>
        <ul class="space-y-2">
          ${posts.map((p) => `<li><a href="/blog/${p.slug}/" class="transition hover:text-white">${esc(p.category)}</a></li>`).join('\n          ')}
        </ul>
      </nav>
      <div>
        <p class="mb-3 font-semibold uppercase tracking-widest text-white">Contact</p>
        <ul class="space-y-2">
          <li><a href="mailto:nipunmitra03@gmail.com" class="transition hover:text-white">nipunmitra03@gmail.com</a></li>
          <li><a href="https://wa.me/8801761227436?text=Hi%20Nipun%2C%20I%20found%20your%20portfolio%20and%20I'd%20like%20to%20talk%20about%20a%20project." target="_blank" rel="noopener" class="transition hover:text-white"><i class="fa-brands fa-whatsapp mr-1.5 text-[#25D366]" aria-hidden="true"></i>WhatsApp</a></li>
          <li><a href="https://github.com/nipunmitra36" target="_blank" rel="noopener" class="transition hover:text-white">GitHub</a></li>
          <li><a href="https://linkedin.com/in/nipunmitra" target="_blank" rel="noopener" class="transition hover:text-white">LinkedIn</a></li>
        </ul>
      </div>
    </div>
    <p class="mx-auto mt-10 max-w-6xl text-xs text-slate-500">© ${new Date().getFullYear()} Nipun Mitra.</p>
  </footer>
  <!-- WhatsApp chat button -->
  <a href="https://wa.me/8801761227436?text=Hi%20Nipun%2C%20I%20found%20your%20portfolio%20and%20I'd%20like%20to%20talk%20about%20a%20project." target="_blank" rel="noopener" aria-label="Chat on WhatsApp"
     class="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-[0_8px_30px_rgba(37,211,102,.45)] transition duration-300 hover:scale-105 sm:bottom-7 sm:right-7">
    <i class="fa-brands fa-whatsapp text-2xl leading-none" aria-hidden="true"></i>
    <span class="hidden pr-1 text-sm font-semibold sm:group-hover:inline">Chat on WhatsApp</span>
  </a>`;
}

// Same twinkling starfield as the home page, trimmed down.
const scripts = `
  <script>
    (() => {
      const c = document.getElementById('space'), ctx = c.getContext('2d');
      const dpr = Math.min(devicePixelRatio, 2), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let w, h, stars = [];
      const colors = ['#ffffff', '#c4b5fd', '#a5f3fc', '#fbcfe8'];
      function resize() {
        w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
        c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
        stars = Array.from({ length: Math.min(300, Math.floor(innerWidth * innerHeight / 4200)) }, () => {
          const blink = Math.random() < .2;
          return { x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.2 + .2) * (Math.random() * 3 + .3),
                   t: Math.random() * 6.3, s: blink ? .02 + Math.random() * .035 : .008 + Math.random() * .018, blink,
                   col: colors[Math.floor(Math.random() * 4)] };
        });
      }
      addEventListener('resize', resize); resize();
      (function draw() {
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) {
          s.t += s.s;
          const v = .5 + Math.sin(s.t) * .5, a = s.blink ? Math.pow(v, 4) : .12 + v * .88;
          ctx.globalAlpha = a; ctx.fillStyle = s.col;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * dpr * .6, 0, 7); ctx.fill();
        }
        if (!still) requestAnimationFrame(draw);
      })();
    })();
  </script>`;

const shell = (headHtml, main, posts) => `${headHtml}
<body class="relative font-sans text-slate-300 antialiased">
  <canvas id="space" aria-hidden="true"></canvas>
  <div class="nebula-bg" aria-hidden="true"></div>
${header}
  <main id="main" class="relative z-10">
${main}
  </main>
${footer(posts)}
${scripts}
</body>
</html>
`;

const person = (site) => ({ '@type': 'Person', '@id': `${site}/#person`, name: 'Nipun Mitra', url: `${site}/`, jobTitle: ['Frontend Developer', 'Software Developer'] });

function card(p) {
  return `
          <article class="glass glow-border group relative flex flex-col overflow-hidden rounded-3xl transition duration-500 hover:-translate-y-1">
            <a href="/blog/${p.slug}/" class="absolute inset-0 z-10" aria-label="${esc(p.title)}"></a>
            <div class="aspect-[1200/630] overflow-hidden">
              <img src="/images/blog/${p.slug}.jpg" alt="${esc(p.title)}" width="1200" height="630" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            </div>
            <div class="flex flex-1 flex-col p-6">
              <p class="text-xs font-semibold uppercase tracking-widest text-nebula-cyan">${esc(p.category)}</p>
              <h2 class="mt-2 font-display text-lg font-bold leading-snug text-white">${esc(p.title)}</h2>
              <p class="mt-3 flex-1 text-sm leading-relaxed text-slate-400">${esc(p.excerpt)}</p>
              <p class="mt-5 flex items-center gap-3 text-xs text-slate-500">
                <time datetime="${p.date}">${formatDate(p.date)}</time><span aria-hidden="true">·</span><span>${readingTime(p.html)} min read</span>
              </p>
            </div>
          </article>`;
}

export function renderIndex(posts, { site, css, buildDate }) {
  const canonical = `${site}/blog/`;
  const title = 'Blog: Web Development Guides | Nipun Mitra';
  const description =
    'Practical guides on custom software development, frontend websites, restaurant and booking websites, and web app development — by developer Nipun Mitra.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${canonical}#blog`,
        url: canonical,
        name: 'Nipun Mitra — Web Development Blog',
        description,
        inLanguage: 'en',
        author: person(site),
        publisher: { '@id': `${site}/#person` },
        dateModified: buildDate,
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          '@id': `${site}/blog/${p.slug}/#article`,
          headline: p.title,
          url: `${site}/blog/${p.slug}/`,
          datePublished: p.date,
          image: `${site}/images/blog/${p.slug}.jpg`,
          author: { '@id': `${site}/#person` },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: canonical },
        ],
      },
    ],
  };

  const main = `
    <section class="px-4 pb-24 pt-36">
      <div class="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" class="mb-6 text-sm text-slate-500">
          <ol class="flex items-center gap-2"><li><a href="/" class="hover:text-white">Home</a></li><li aria-hidden="true">/</li><li class="text-slate-300" aria-current="page">Blog</li></ol>
        </nav>
        <p class="font-mono text-sm text-nebula-cyan">Blog</p>
        <h1 class="mt-3 font-display text-4xl font-black leading-tight text-white sm:text-6xl">Web development <span class="text-gradient">guides</span></h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">Practical, no-nonsense articles on custom software development, frontend websites, restaurant and booking websites, and web app development.</p>

        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${posts.map(card).join('')}
        </div>
      </div>
    </section>`;

  return shell(
    head({ site, css, title, description, canonical, image: `${site}/og-image.jpg`, imageAlt: 'Nipun Mitra — Frontend Developer & Software Developer', type: 'website', jsonLd }),
    main,
    posts,
  );
}

export function renderPost(post, posts, { site, css, buildDate }) {
  const canonical = `${site}/blog/${post.slug}/`;
  const image = `${site}/images/blog/${post.slug}.jpg`;
  const words = wordCount(post.html);
  const minutes = readingTime(post.html);
  const sections = toc(post.html);
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  // Keep the brand suffix only when the title still fits in Google's ~60 characters.
  const title = `${post.metaTitle} | Nipun Mitra`.length <= 60 ? `${post.metaTitle} | Nipun Mitra` : post.metaTitle;

  const jsonLd = {
    '@context': 'https://schema.org',
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
        dateModified: buildDate > post.date ? buildDate : post.date,
        author: person(site),
        publisher: { '@id': `${site}/#person` },
        isPartOf: { '@id': `${site}/blog/#blog` },
        articleSection: post.category,
        keywords: [post.keyword, ...post.tags].join(', '),
        wordCount: words,
        timeRequired: `PT${minutes}M`,
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  const extraMeta = [
    `  <meta property="article:published_time" content="${post.date}T00:00:00Z" />`,
    `  <meta property="article:modified_time" content="${(buildDate > post.date ? buildDate : post.date)}T00:00:00Z" />`,
    `  <meta property="article:author" content="${site}/" />`,
    `  <meta property="article:section" content="${esc(post.category)}" />`,
    ...post.tags.map((t) => `  <meta property="article:tag" content="${esc(t)}" />`),
  ].join('\n');

  const main = `
    <article class="px-4 pb-24 pt-36">
      <div class="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" class="mb-6 text-sm text-slate-500">
          <ol class="flex flex-wrap items-center gap-2">
            <li><a href="/" class="hover:text-white">Home</a></li><li aria-hidden="true">/</li>
            <li><a href="/blog/" class="hover:text-white">Blog</a></li><li aria-hidden="true">/</li>
            <li class="text-slate-300" aria-current="page">${esc(post.category)}</li>
          </ol>
        </nav>

        <header class="max-w-4xl">
          <p class="text-xs font-semibold uppercase tracking-widest text-nebula-cyan">${esc(post.category)}</p>
          <h1 class="mt-3 font-display text-3xl font-black leading-tight text-white sm:text-5xl">${esc(post.title)}</h1>
          <p class="mt-5 text-lg leading-relaxed text-slate-400">${esc(post.description)}</p>
          <div class="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span class="flex items-center gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display text-xs font-bold text-white">NM</span>
              <a href="/" rel="author" class="text-white hover:text-nebula-cyan">Nipun Mitra</a>
            </span>
            <span aria-hidden="true">·</span><time datetime="${post.date}">${formatDate(post.date)}</time>
            <span aria-hidden="true">·</span><span>${minutes} min read</span>
          </div>
        </header>

        <figure class="mt-10 overflow-hidden rounded-3xl border border-white/10">
          <img src="/images/blog/${post.slug}.jpg" alt="${esc(post.title)}" width="1200" height="630" fetchpriority="high" class="w-full" />
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

            <aside class="glass relative mt-14 overflow-hidden rounded-3xl p-8">
              <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-nebula-violet/25 blur-3xl"></div>
              <p class="relative font-display text-2xl font-bold text-white">Need help with ${esc(post.keyword)}?</p>
              <p class="relative mt-3 max-w-xl text-slate-400">Tell me about your project and I'll suggest the simplest way to build it well — no obligation.</p>
              <a href="https://wa.me/8801761227436?text=Hi%20Nipun%2C%20I%20found%20your%20portfolio%20and%20I'd%20like%20to%20talk%20about%20a%20project." target="_blank" rel="noopener" class="relative mt-6 mr-3 inline-flex items-center gap-3 rounded-full bg-[#25D366] px-7 py-3.5 font-semibold text-white transition duration-300 hover:shadow-[0_0_40px_rgba(37,211,102,.45)]"><i class="fa-brands fa-whatsapp text-lg"></i> WhatsApp</a>
              <a href="/#contact" class="relative mt-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-nebula-violet to-nebula-cyan px-7 py-3.5 font-semibold text-white transition duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,.5)]">Get in touch <i class="fa-solid fa-arrow-right text-sm"></i></a>
            </aside>

            <div class="mt-10 flex items-start gap-4 rounded-3xl border border-white/10 p-6">
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display font-bold text-white">NM</span>
              <div>
                <p class="font-semibold text-white">Written by Nipun Mitra</p>
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

    <section aria-labelledby="related" class="px-4 pb-24">
      <div class="mx-auto max-w-6xl">
        <h2 id="related" class="font-display text-2xl font-bold text-white sm:text-3xl">Keep reading</h2>
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${related.map(card).join('')}
        </div>
      </div>
    </section>`;

  return shell(
    head({ site, css, title, description: post.description, canonical, image, imageAlt: post.title, type: 'article', extraMeta, jsonLd }),
    main,
    posts,
  );
}
