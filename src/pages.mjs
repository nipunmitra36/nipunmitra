// The site's main pages — one per menu item. Section markup lives in src/sections/*.html.

import { readFileSync } from 'node:fs';
import { SITE, ctaBand, person, breadcrumbs, canonicalFor } from './layout.mjs';
import { posts } from './posts.mjs';
import { postCard } from './blog.mjs';

const section = (name) => readFileSync(new URL(`./sections/${name}.html`, import.meta.url), 'utf8');

// Section links were written for the old one-page layout; point them at the real pages.
const fixLinks = (html) =>
  html
    .replace(/href="#projects"/g, 'href="projects.html"')
    .replace(/href="#contact"/g, 'href="contact.html"')
    .replace(/href="#about"/g, 'href="about.html"')
    .replace(/href="\/blog\/([a-z0-9-]+)\/"/g, 'href="blog/$1.html"')
    .replace(/href="\/blog\/"/g, 'href="blog.html"');

const dropNumber = (html) => html.replace(/(<p class="font-mono text-sm text-nebula-cyan">)\d\d · ([^<]+)(<\/p>)/, '$1$2$3');

// Turn a section into the main content of its own page: first heading becomes the h1,
// and the top padding clears the fixed menu.
function standalone(name) {
  let html = section(name).replace(/<!-- =+ \w+ =+ -->\s*/, '');
  html = html.replace(/(<section[^>]*?)\bpy-28\b/, '$1pb-24 pt-36');
  html = html.replace(/<h2 class="([^"]*)">([\s\S]*?)<\/h2>/, '<h1 class="$1">$2</h1>');
  return fixLinks(dropNumber(html));
}

const home = JSON.parse(readFileSync(new URL('./home-jsonld.json', import.meta.url), 'utf8'));
const node = (type) => home['@graph'].find((n) => n['@type'] === type);

const webPage = (type, file, name, description, extra = {}) => ({
  '@type': type,
  '@id': `${canonicalFor(file)}#webpage`,
  url: canonicalFor(file),
  name,
  description,
  isPartOf: { '@id': `${SITE}/#website` },
  about: person(),
  inLanguage: 'en',
  ...extra,
});

const page = ({ file, active, label, title, description, type = 'WebPage', extra = {}, nodes = [], main }) => ({
  file,
  active,
  title,
  description,
  jsonLd: { '@graph': [webPage(type, file, title, description, extra), ...nodes, breadcrumbs([['Home', 'index.html'], [label, file]])] },
  main,
});

// ---------- Home ----------
const projectCards = [...section('projects').matchAll(/<a href="https:\/\/[^"]*" target="_blank" rel="noopener" data-cat=[\s\S]*?\n\s*<\/a>/g)].map((m) => m[0]);

const homeMain = [
  section('hero').replace('href="#about" class="absolute bottom-6', 'href="#services" class="absolute bottom-6'),
  section('marquee'),
  fixLinks(dropNumber(section('services'))),
  `
    <section id="featured-projects" class="px-4 py-28">
      <div class="mx-auto max-w-6xl">
        <div class="reveal mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p class="font-mono text-sm text-nebula-cyan">Projects</p>
            <h2 class="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">Featured <span class="text-gradient">work</span></h2>
          </div>
          <a href="projects.html" class="glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">View all projects <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></a>
        </div>
        <div id="project-grid" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          ${projectCards.slice(0, 3).join('\n          ')}
        </div>
      </div>
    </section>

    <section id="latest-articles" class="px-4 pb-28">
      <div class="mx-auto max-w-6xl">
        <div class="reveal mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p class="font-mono text-sm text-nebula-cyan">Blog</p>
            <h2 class="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">Latest <span class="text-gradient">guides</span></h2>
          </div>
          <a href="blog.html" class="glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Read the blog <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></a>
        </div>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${posts.slice(0, 3).map((p) => postCard(p, '', 'h3')).join('')}
        </div>
      </div>
    </section>`,
  ctaBand(''),
].join('\n');

// ---------- Services: how I work ----------
const howIWork = `
    <section class="px-4 pb-28">
      <div class="mx-auto max-w-6xl">
        <div class="reveal mb-10">
          <p class="font-mono text-sm text-nebula-cyan">Process</p>
          <h2 class="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">How I <span class="text-gradient">work</span></h2>
        </div>
        <ol class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          ${[
            ['fa-magnifying-glass', 'Discover', 'We talk through your goals, your users and how things work today, then agree on what success looks like.'],
            ['fa-pen-ruler', 'Design', 'Wireframes and designs in Figma, so you can click through the product before any code is written.'],
            ['fa-code', 'Build', 'Working software every week or two on a preview link — React, Next.js, TypeScript and Laravel under the hood.'],
            ['fa-rocket', 'Launch &amp; support', 'Deployment, SEO, analytics and monitoring, plus fixes and improvements once real users arrive.'],
          ].map(([icon, h, p], i) => `<li class="reveal glass rounded-3xl p-7">
            <span class="font-mono text-sm text-slate-500">0${i + 1}</span>
            <i class="fa-solid ${icon} mt-4 block text-2xl text-nebula-cyan" aria-hidden="true"></i>
            <h3 class="mt-4 font-display text-lg font-bold text-white">${h}</h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-400">${p}</p>
          </li>`).join('\n          ')}
        </ol>
      </div>
    </section>`;

// [service name, page that explains it]
const services = [
  ['Custom software development', 'blog/custom-software-development.html'],
  ['App development', 'blog/web-app-development.html'],
  ['UI/UX design', 'blog/ui-ux-design.html'],
  ['Web design and development', 'blog/frontend-website-development.html'],
  ['SEO and digital marketing', 'blog/seo-for-small-business.html'],
];

export const pages = [
  {
    file: 'index.html',
    active: 'home',
    title: 'Nipun Mitra | Software Developer',
    description:
      'Nipun Mitra – software developer in Dhaka offering custom software development, app development, UI/UX design, web design & development, and SEO.',
    jsonLd: { '@graph': home['@graph'] },
    main: homeMain,
  },
  page({
    file: 'about.html',
    active: 'about',
    label: 'About',
    type: 'AboutPage',
    title: 'About Nipun Mitra | Software Developer in Dhaka',
    description:
      'Get to know Nipun Mitra, a software developer in Dhaka who has spent 3+ years building websites and web apps at CodeWare Ltd and Mamurjor IT.',
    extra: { mainEntity: person() },
    nodes: [node('Person')],
    main: standalone('about') + ctaBand(''),
  }),
  page({
    file: 'services.html',
    active: 'services',
    label: 'Services',
    title: 'Software Development Services | Nipun Mitra',
    description:
      'Custom software development, app development, UI/UX design, web design and development, and SEO & digital marketing — by software developer Nipun Mitra.',
    extra: {
      mainEntity: {
        '@type': 'OfferCatalog',
        name: 'Software development services',
        itemListElement: services.map(([name, file]) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name, url: canonicalFor(file), provider: person() },
        })),
      },
    },
    main: standalone('services') + howIWork + ctaBand(''),
  }),
  page({
    file: 'skills.html',
    active: 'skills',
    label: 'Skills',
    title: 'Skills & Tech Stack | Nipun Mitra, Software Developer',
    description:
      'React, Next.js, TypeScript, Tailwind CSS, Laravel, WordPress and the tools I use every day — the tech stack behind the websites and web apps I build.',
    main: standalone('skills').replace('absolute right-[5%] top-6', 'absolute right-[5%] top-28') + ctaBand(''),
  }),
  page({
    file: 'experience.html',
    active: 'experience',
    label: 'Experience',
    title: 'Work Experience | Nipun Mitra, Software Developer',
    description:
      'Frontend Developer at CodeWare Ltd since August 2022, previously at Mamurjor IT — 20+ client websites and live projects with Next.js, Laravel and WordPress.',
    main: standalone('experience') + ctaBand(''),
  }),
  page({
    file: 'projects.html',
    active: 'projects',
    label: 'Projects',
    type: 'CollectionPage',
    title: 'Projects & Portfolio | Nipun Mitra, Software Developer',
    description:
      'Selected projects: CW Skills, Bangladesh Medical University, Crystal Valet, iDesk360 and more — websites and web apps built with Next.js, Laravel and WordPress.',
    extra: { mainEntity: { '@id': `${SITE}/#projects` } },
    nodes: [node('ItemList')],
    main: standalone('projects') + ctaBand(''),
  }),
  page({
    file: 'education.html',
    active: 'education',
    label: 'Education',
    title: 'Education & Certifications | Nipun Mitra',
    description:
      'B.Sc. in CSE at Northern University Bangladesh, a Diploma in Computer Technology, and certifications in PHP & Laravel and frontend development.',
    main: standalone('education') + ctaBand(''),
  }),
  page({
    file: 'contact.html',
    active: 'contact',
    label: 'Contact',
    type: 'ContactPage',
    title: 'Contact Nipun Mitra | Hire a Software Developer',
    description:
      'Have a project in mind? Contact Nipun Mitra by email, phone or WhatsApp to talk about custom software, a new website or web app development.',
    extra: { mainEntity: person() },
    main: standalone('contact'),
  }),
];
