// Shared page shell: <head> with SEO tags, menu, background, footer and scripts.
// Every page on the site is rendered through renderPage(), so the menu and footer are identical everywhere.
//
// Links are relative (about.html, ../contact.html) so pages work when opened straight from disk
// as well as on any web host. {{SITE_URL}} and {{BUILD_DATE}} are filled in by build.mjs.

import { posts } from './posts.mjs';

export const SITE = '{{SITE_URL}}';
export const WA = 'https://wa.me/8801761227436?text=' + encodeURIComponent("Hi Nipun, I found your portfolio and I'd like to talk about a project.");

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Menu order. `file` is relative to the site root.
export const MENU = [
  { key: 'about', label: 'About', file: 'about.html' },
  { key: 'services', label: 'Services', file: 'services.html' },
  { key: 'skills', label: 'Skills', file: 'skills.html' },
  { key: 'experience', label: 'Experience', file: 'experience.html' },
  { key: 'projects', label: 'Projects', file: 'projects.html' },
  { key: 'education', label: 'Education', file: 'education.html' },
  { key: 'blog', label: 'Blog', file: 'blog.html' },
];

export const baseFor = (file) => '../'.repeat(file.split('/').length - 1);

// The first image of a grid is visible on load, so don't lazy-load it. Normal priority on purpose:
// it's rarely the LCP element and shouldn't compete with the one that is.
export const eagerFirst = (html, count = 1) => {
  let i = 0;
  return html.replace(/ loading="lazy" decoding="async"/g, (m) => (i++ >= count ? m : ' decoding="async"'));
};
export const canonicalFor = (file) => (file === 'index.html' ? `${SITE}/` : `${SITE}/${file}`);

export const person = () => ({ '@id': `${SITE}/#person` });
export const breadcrumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, file], i) => ({ '@type': 'ListItem', position: i + 1, name, item: canonicalFor(file) })),
});

function header(base, active) {
  const linkCls = 'rounded-full px-3.5 py-2 transition hover:bg-white/5 hover:text-white';
  const activeCls = 'rounded-full bg-white/10 px-3.5 py-2 text-white';
  const mobCls = 'block rounded-2xl px-4 py-3 hover:bg-white/5';
  const current = (m) => (m.key === active ? ' aria-current="page"' : '');
  return `
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-void">Skip to content</a>

  <header class="fixed inset-x-0 top-4 z-50 px-4">
    <nav aria-label="Primary" class="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 sm:px-6">
      <a href="${base}index.html" class="flex items-center gap-2.5"${active === 'home' ? ' aria-current="page"' : ''}>
        <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display text-sm font-bold text-white">NM</span>
        <span class="hidden font-display text-sm tracking-widest text-white sm:block">Nipun Mitra</span>
      </a>
      <ul class="hidden items-center gap-0.5 text-sm lg:flex">
${MENU.map((m) => `        <li><a href="${base}${m.file}" class="${m.key === active ? activeCls : linkCls}"${current(m)}>${m.label}</a></li>`).join('\n')}
      </ul>
      <div class="flex items-center gap-2">
        <a href="${base}contact.html" class="hidden rounded-full bg-white px-5 py-2 text-sm font-semibold text-void transition hover:bg-nebula-cyan sm:inline-flex sm:items-center sm:gap-2"${active === 'contact' ? ' aria-current="page"' : ''}>
          Let's talk <i class="fa-solid fa-arrow-right text-xs"></i>
        </a>
        <button id="menu-btn" type="button" class="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
          <i class="fa-solid fa-bars-staggered"></i>
        </button>
      </div>
    </nav>
    <div id="mobile-menu" class="glass mx-auto mt-2 hidden max-w-6xl rounded-3xl p-3 lg:hidden">
      <a href="${base}index.html" class="${mobCls}">Home</a>
${[...MENU, { key: 'contact', label: 'Contact', file: 'contact.html' }]
  .map((m) => `      <a href="${base}${m.file}" class="${mobCls}${m.key === active ? ' bg-white/10 text-white' : ''}"${current(m)}>${m.label}</a>`).join('\n')}
    </div>
  </header>`;
}

function footer(base) {
  const link = 'transition hover:text-white';
  return `
  <footer class="relative z-10 border-t border-white/5 px-4 py-14">
    <div class="mx-auto grid max-w-6xl gap-10 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <a href="${base}index.html" class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nebula-violet to-nebula-cyan font-display text-sm font-bold text-white">NM</span>
          <span class="font-display tracking-widest text-white">Nipun Mitra</span>
        </a>
        <p class="mt-4 leading-relaxed">Software developer in Dhaka, Bangladesh, building custom software, web apps and fast, SEO-friendly websites.</p>
      </div>
      <nav aria-label="Pages">
        <p class="mb-3 font-semibold uppercase tracking-widest text-white">Pages</p>
        <ul class="grid grid-cols-2 gap-2">
          <li><a href="${base}index.html" class="${link}">Home</a></li>
${[...MENU, { label: 'Contact', file: 'contact.html' }].map((m) => `          <li><a href="${base}${m.file}" class="${link}">${m.label}</a></li>`).join('\n')}
        </ul>
      </nav>
      <nav aria-label="Guides">
        <p class="mb-3 font-semibold uppercase tracking-widest text-white">Guides</p>
        <ul class="space-y-2">
${posts.slice(0, 6).map((p) => `          <li><a href="${base}blog/${p.slug}.html" class="${link}">${esc(p.category)}</a></li>`).join('\n')}
          <li><a href="${base}blog.html" class="font-semibold text-nebula-cyan hover:text-white">All articles →</a></li>
        </ul>
      </nav>
      <div>
        <p class="mb-3 font-semibold uppercase tracking-widest text-white">Contact</p>
        <ul class="space-y-2">
          <li><a href="mailto:nipunmitra03@gmail.com" class="${link}"><i class="fa-solid fa-envelope mr-2 w-4 text-nebula-pink" aria-hidden="true"></i>nipunmitra03@gmail.com</a></li>
          <li><a href="tel:+8801761227436" class="${link}"><i class="fa-solid fa-phone mr-2 w-4 text-emerald-400" aria-hidden="true"></i>+88 01761 227436</a></li>
          <li><a href="${WA}" target="_blank" rel="noopener" class="${link}"><i class="fa-brands fa-whatsapp mr-2 w-4 text-[#25D366]" aria-hidden="true"></i>WhatsApp</a></li>
          <li><a href="https://github.com/nipunmitra36" target="_blank" rel="noopener" class="${link}"><i class="fa-brands fa-github mr-2 w-4" aria-hidden="true"></i>GitHub</a></li>
          <li><a href="https://linkedin.com/in/nipunmitra" target="_blank" rel="noopener" class="${link}"><i class="fa-brands fa-linkedin mr-2 w-4 text-sky-400" aria-hidden="true"></i>LinkedIn</a></li>
        </ul>
      </div>
    </div>
    <p class="mx-auto mt-12 max-w-6xl text-xs text-slate-400">© {{YEAR}} Nipun Mitra. Designed &amp; built in Dhaka.</p>
  </footer>

  <!-- WhatsApp chat button -->
  <a href="${WA}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"
     class="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-[0_8px_30px_rgba(37,211,102,.45)] transition duration-300 hover:scale-105 sm:bottom-7 sm:right-7">
    <i class="fa-brands fa-whatsapp text-2xl leading-none" aria-hidden="true"></i>
    <span class="hidden pr-1 text-sm font-semibold sm:group-hover:inline">Chat on WhatsApp</span>
  </a>`;
}

// Drifting planets behind the content — real transparent PNGs (parallax is handled in main.js).
// Only the first one (top of the page, often the LCP element on phones) loads eagerly.
// The wrapper drifts (`wander`) and the image slowly turns; a hue shift gives each copy its own colour.
const PLANETS = (home) => [
  { img: 'planet-2.png', pos: home ? 'top:120px; left:5%' : 'top:110px; right:2%', size: home ? 120 : 90, speed: -0.12, w: 22, spin: '200s linear infinite reverse' },
  { img: 'planet-1.png', pos: home ? 'top:13%; left:-40px' : 'top:38%; left:-70px', size: 130, speed: -0.18, w: 28, wd: -6, spin: '150s linear infinite', hue: 140 },
  { img: 'planet-3.png', pos: 'top:50%; right:-130px', size: 340, speed: -0.06, w: 45, spin: 'tilt 18s ease-in-out infinite', opacity: 0.7 },
  { img: 'planet-1.png', pos: 'top:63%; right:12%', size: 90, speed: -0.15, w: 24, wd: -8, spin: '120s linear infinite reverse', hue: 190 },
  { img: 'planet-2.png', pos: 'top:72%; left:-60px', size: 170, speed: -0.14, w: 34, wd: -15, spin: '220s linear infinite', hue: 160, sat: 2.2, opacity: 0.85 },
  { img: 'planet-3.png', pos: 'top:88%; right:8%', size: 70, speed: -0.2, w: 20, wd: -4, spin: 'tilt 12s ease-in-out infinite', hue: 280 },
];

const planets = (base, home) => `
  <div id="planets" class="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
${PLANETS(home).map((p, i) => {
  const filter = [p.hue && `hue-rotate(${p.hue}deg)`, p.sat && `saturate(${p.sat})`].filter(Boolean).join(' ');
  const anim = p.spin.startsWith('tilt') ? p.spin : `spin ${p.spin}`;
  return `    <div class="bg-planet" data-speed="${p.speed}" style="${p.pos}; width:${p.size}px; height:${p.size}px; --w:${p.w}s${p.wd ? `; --wd:${p.wd}s` : ''}${p.opacity ? `; opacity:${p.opacity}` : ''}">
      <img src="${base}${p.img}" alt="" width="500" height="500" sizes="${p.size}px"${i === 0 ? '' : ' loading="lazy"'} decoding="async" class="h-full w-full select-none drop-shadow-[0_0_30px_rgba(167,139,250,.2)]" style="animation: ${anim}${filter ? `; filter: ${filter}` : ''}" draggable="false" />
    </div>`;
}).join('\n')}
  </div>`;

/**
 * @param {object} o
 * @param {string} o.file        output path relative to the site root, e.g. 'about.html' or 'blog/x.html'
 * @param {string} o.active      menu key to highlight ('home', 'about', …, 'contact')
 * @param {string} o.title       <title> (keep ≤ 60 chars)
 * @param {string} o.description meta description (≈ 150–160 chars)
 * @param {object} o.jsonLd      structured data (an object with @graph)
 * @param {string} o.main        page content
 */
export function renderPage({ file, active, title, description, jsonLd, main, ogType = 'website', ogImage = 'og-image.jpg', ogImageAlt = 'Nipun Mitra — Software Developer', extraMeta = '' }) {
  const base = baseFor(file);
  const canonical = canonicalFor(file);
  const image = `${SITE}/${ogImage}`;
  return `<!doctype html>
<!-- Generated by scripts/generate.mjs from src/ — edit the source files, then run \`npm run generate\`. -->
<html lang="en" dir="ltr" class="no-js">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>document.documentElement.classList.replace('no-js', 'js');</script>

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="author" content="Nipun Mitra" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="google-site-verification" content="D8PaL5uJ0KoIl25mIFRq8a71Co-q1QxE6odppjHcIpk" />
  <link rel="canonical" href="${canonical}" />
  <meta name="theme-color" content="#04050d" />
  <meta name="color-scheme" content="dark" />
  <meta name="format-detection" content="telephone=no" />

  <meta property="og:type" content="${ogType}" />
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
  <meta property="og:image:alt" content="${esc(ogImageAlt)}" />
${extraMeta}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${esc(ogImageAlt)}" />

  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="${base}icon-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="${base}apple-touch-icon.png" sizes="180x180" />
  <link rel="manifest" href="${base}site.webmanifest" />
  <link rel="alternate" type="application/rss+xml" title="Nipun Mitra — Blog" href="${SITE}/blog/rss.xml" />

  <script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', ...jsonLd }, null, 2)}
  </script>

  <!-- build:preload-fonts (the build preloads the self-hosted fonts; skipped here because browsers block it for file:// pages) -->

  <!-- Tailwind CDN for local preview; \`npm run build\` swaps this block for a compiled stylesheet. -->
  <!-- build:tailwind -->
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script src="${base}assets/tailwind.config.js"></script>
  <!-- /build:tailwind -->
  <!-- build:inline-css (fonts.css + site.css are inlined by the build) -->
  <link rel="stylesheet" href="${base}assets/fonts.css" />
  <link rel="stylesheet" href="${base}assets/site.css" />
  <!-- /build:inline-css -->

  <!-- Icon font: not needed for first paint, so it loads without blocking. -->
  <link rel="stylesheet" href="${base}assets/vendor/fontawesome-6.5.1/css/all.min.css" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="${base}assets/vendor/fontawesome-6.5.1/css/all.min.css" /></noscript>
</head>

<body class="relative font-sans text-slate-300 antialiased">
  <canvas id="space" aria-hidden="true"></canvas>
  <div class="nebula-bg" aria-hidden="true"></div>
${planets(base, active === 'home')}
${header(base, active)}

  <main id="main" class="relative z-10">
${main}
  </main>
${footer(base)}

  <script src="${base}assets/vendor/lenis-1.1.13.min.js" defer></script>
  <script src="${base}assets/main.js" defer></script>
</body>
</html>
`;
}

// "Have a project?" band shown at the bottom of most pages.
export const ctaBand = (base) => `
    <section class="px-4 pb-28">
      <div class="reveal glass relative mx-auto max-w-6xl overflow-clip rounded-[2rem] p-8 sm:p-12">
        <div class="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-nebula-violet/25 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-nebula-cyan/20 blur-3xl"></div>
        <div class="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div class="max-w-2xl">
            <h2 class="font-display text-2xl font-bold text-white sm:text-4xl">Have a project in mind?</h2>
            <p class="mt-4 text-slate-400">Custom software, a new website or a full web app — tell me what you need and I'll suggest the simplest way to build it well.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <a href="${base}contact.html" class="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-nebula-violet to-nebula-cyan px-7 py-3.5 font-semibold text-white transition duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,.5)]">Get in touch <i class="fa-solid fa-arrow-right text-sm" aria-hidden="true"></i></a>
            <a href="${WA}" target="_blank" rel="noopener" class="inline-flex items-center gap-3 rounded-full bg-[#25D366] px-7 py-3.5 font-semibold text-[#052e16] transition duration-300 hover:shadow-[0_0_40px_rgba(37,211,102,.45)]"><i class="fa-brands fa-whatsapp text-lg" aria-hidden="true"></i> WhatsApp</a>
          </div>
        </div>
      </div>
    </section>`;
