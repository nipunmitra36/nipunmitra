// Downloads page: Nipun's own apps, shown in a Google Play-style layout.
// Facts (version, Android requirement, permissions, size, checksum) come from the APK itself;
// size and checksum are read from the file at build time so they can't go stale.
//
// To add an app: put the .apk in downloads/, the icon in images/apps/ (and in scripts/images.mjs),
// then add an entry to APPS.

import { readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SITE, esc, person, breadcrumbs, canonicalFor } from './layout.mjs';

const ROOT = new URL('../', import.meta.url);

export const APPS = [
  {
    id: 'daily-cost',
    name: 'Daily Cost',
    tagline: 'Track your everyday spending',
    category: 'Finance',
    apk: 'downloads/daily-cost-1.0.apk',
    icon: 'images/apps/daily-cost.png',
    version: '1.0',
    versionCode: 1,
    package: 'com.aistudio.dailycost.nmxp',
    minAndroid: 'Android 7.0 and up', // minSdkVersion 24
    targetAndroid: 'Android 16', // targetSdkVersion 36
    updated: '2026-10-31',
    price: 'Free',
    // ✏️ Edit this text to describe your app in your own words.
    description: [
      'Daily Cost is a simple Android app for keeping track of what you spend every day. Note down your costs as they happen and keep your daily spending in one place.',
      'It can send you reminder notifications, so logging your expenses becomes a habit and nothing slips through.',
    ],
    whatsNew: 'First release.',
    tags: ['Expense tracker', 'Daily budget', 'Reminders'],
    // From the APK's AndroidManifest.xml, explained in plain language.
    permissions: [
      ['fa-bell', 'Notifications', 'Show reminder notifications.'],
      ['fa-clock', 'Exact alarms', 'Send reminders at the exact time you choose.'],
      ['fa-power-off', 'Run at startup', 'Re-schedule your reminders after the phone restarts.'],
      ['fa-mobile-screen-button', 'Vibration', 'Vibrate for reminders.'],
      ['fa-wifi', 'Network access', 'Connect to the internet and check the connection status.'],
    ],
  },
];

function fileFacts(app) {
  const url = new URL(app.apk, ROOT);
  if (!existsSync(url)) throw new Error(`Missing ${app.apk}`);
  const bytes = statSync(url).size;
  return {
    bytes,
    size: `${(bytes / 1024 / 1024).toFixed(1)} MB`,
    sha256: createHash('sha256').update(readFileSync(url)).digest('hex'),
  };
}

const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// The icon PNG has a dark background around a rounded square; zooming slightly inside a rounded
// frame shows only the icon itself, like an app store tile.
const appIcon = (app, size, extra = '') => `
            <div class="${size} shrink-0 overflow-hidden rounded-[22%] shadow-[0_12px_40px_-8px_rgba(16,185,129,.45)] ring-1 ring-white/10 ${extra}">
              <img src="${app.icon}" sizes="${size.includes('h-28') ? '112px' : '96px'}" alt="${esc(app.name)} app icon" width="1254" height="1254" class="h-full w-full scale-[1.18] object-cover" fetchpriority="high" decoding="async" />
            </div>`;

function appDetail(app) {
  const f = fileFacts(app);
  const file = app.apk.split('/').pop();
  const stat = (value, label, icon) => `
              <div class="flex flex-col items-center px-5 text-center first:pl-0 sm:px-7">
                <span class="flex items-center gap-1.5 whitespace-nowrap text-base font-semibold text-white">${icon ? `<i class="fa-solid ${icon} text-sm" aria-hidden="true"></i>` : ''}${value}</span>
                <span class="mt-1 whitespace-nowrap text-xs text-slate-400">${label}</span>
              </div>`;
  return `
      <article id="${app.id}" class="reveal glass relative overflow-clip rounded-[2rem] p-6 sm:p-10">
        <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden="true"></div>

        <!-- Title block -->
        <div class="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          ${appIcon(app, 'h-24 w-24 sm:h-28 sm:w-28')}
          <div class="min-w-0">
            <h2 class="font-heading text-3xl font-bold text-white sm:text-4xl">${esc(app.name)}</h2>
            <a href="about.html" class="mt-1 inline-block font-semibold text-emerald-400 hover:text-emerald-300">Nipun Mitra</a>
            <p class="mt-1 text-sm text-slate-400">${esc(app.tagline)} · ${esc(app.category)}</p>
          </div>
        </div>

        <!-- Stats row (Play Store style) -->
        <div class="relative mt-7 flex overflow-x-auto divide-x divide-white/10 pb-1">
          ${[
            stat(app.price, 'Price'),
            stat(f.size, 'Download size'),
            stat(app.version, 'Version'),
            stat('7.0+', 'Android'),
            stat(`<span class="rounded-full border border-emerald-400/40 px-2 text-xs font-bold text-emerald-300">NEW</span>`, 'Just released'),
          ].join('')}
        </div>

        <!-- Install / share -->
        <div class="relative mt-7 flex flex-wrap items-center gap-3">
          <a href="${app.apk}" download="${file}" type="application/vnd.android.package-archive" data-apk
             class="inline-flex min-w-[220px] items-center justify-center gap-2.5 rounded-xl bg-[#01875f] px-8 py-3.5 font-semibold text-white shadow-[0_10px_30px_-8px_rgba(1,135,95,.7)] transition hover:bg-[#017a56]">
            <i class="fa-solid fa-download" aria-hidden="true"></i> Install · ${f.size}
          </a>
          <button type="button" data-share="${canonicalFor('downloads.html')}#${app.id}" data-share-title="${esc(app.name)} — Android app by Nipun Mitra"
                  class="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-emerald-400 transition hover:bg-white/5">
            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> <span data-share-label>Share</span>
          </button>
          <p class="w-full text-xs text-slate-400"><i class="fa-brands fa-android mr-1.5 text-emerald-400" aria-hidden="true"></i>Android APK · ${esc(app.minAndroid)} · Installs outside Google Play — <a href="#install-help" class="underline decoration-white/30 underline-offset-2 hover:text-white">how to install</a></p>
        </div>

        <div class="relative mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div class="min-w-0 space-y-10">
            <!-- About -->
            <section aria-labelledby="${app.id}-about">
              <h3 id="${app.id}-about" class="flex items-center gap-2 font-heading text-xl font-bold text-white">About this app <i class="fa-solid fa-arrow-right text-sm text-slate-400" aria-hidden="true"></i></h3>
              <div class="mt-3 space-y-3 leading-relaxed text-slate-300">${app.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
              <p class="mt-4 text-sm text-slate-400">Updated on ${fmtDate(app.updated)}</p>
              <div class="mt-4 flex flex-wrap gap-2">${[app.category, ...app.tags].map((t) => `<span class="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-slate-300">${esc(t)}</span>`).join('')}</div>
            </section>

            <!-- What's new -->
            <section aria-labelledby="${app.id}-new">
              <h3 id="${app.id}-new" class="font-heading text-xl font-bold text-white">What’s new</h3>
              <p class="mt-3 text-slate-300">Version ${esc(app.version)} — ${esc(app.whatsNew)}</p>
            </section>

            <!-- Permissions / data -->
            <section aria-labelledby="${app.id}-perm">
              <h3 id="${app.id}-perm" class="font-heading text-xl font-bold text-white">App permissions</h3>
              <p class="mt-2 text-sm text-slate-400">What the app is allowed to do on your phone, as declared in the APK.</p>
              <ul class="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
                ${app.permissions.map(([icon, name, why]) => `<li class="flex items-start gap-4 p-4">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
                  <span><span class="block font-semibold text-white">${esc(name)}</span><span class="text-sm text-slate-400">${esc(why)}</span></span>
                </li>`).join('\n                ')}
              </ul>
            </section>
          </div>

          <!-- App info sidebar -->
          <aside class="space-y-6">
            <section aria-labelledby="${app.id}-info" class="rounded-2xl border border-white/10 p-5">
              <h3 id="${app.id}-info" class="font-heading text-lg font-bold text-white">App info</h3>
              <dl class="mt-4 space-y-3 text-sm">
                ${[
                  ['Version', app.version],
                  ['Updated on', fmtDate(app.updated)],
                  ['Requires Android', app.minAndroid.replace('Android ', '')],
                  ['Download size', `${f.size} (${f.bytes.toLocaleString('en')} bytes)`],
                  ['Developer', 'Nipun Mitra'],
                  ['Package', `<span class="break-all font-mono text-xs">${esc(app.package)}</span>`],
                ].map(([k, v]) => `<div><dt class="text-slate-400">${k}</dt><dd class="text-white">${v}</dd></div>`).join('\n                ')}
              </dl>
            </section>
            <section aria-labelledby="${app.id}-verify" class="rounded-2xl border border-white/10 p-5">
              <h3 id="${app.id}-verify" class="font-heading text-lg font-bold text-white">Verify the file</h3>
              <p class="mt-2 text-sm text-slate-400">SHA-256 of <span class="font-mono text-xs text-slate-300">${file}</span>:</p>
              <p class="mt-2 break-all rounded-lg bg-white/5 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">${f.sha256}</p>
            </section>
            <section aria-labelledby="${app.id}-dev" class="rounded-2xl border border-white/10 p-5">
              <h3 id="${app.id}-dev" class="font-heading text-lg font-bold text-white">Developer contact</h3>
              <ul class="mt-3 space-y-2 text-sm">
                <li><a href="mailto:nipunmitra03@gmail.com?subject=${encodeURIComponent(app.name + ' app')}" class="text-slate-300 hover:text-white"><i class="fa-solid fa-envelope mr-2 w-4 text-emerald-400" aria-hidden="true"></i>nipunmitra03@gmail.com</a></li>
                <li><a href="contact.html" class="text-slate-300 hover:text-white"><i class="fa-solid fa-globe mr-2 w-4 text-emerald-400" aria-hidden="true"></i>Contact page</a></li>
              </ul>
            </section>
          </aside>
        </div>
      </article>`;
}

const installHelp = `
      <section id="install-help" aria-labelledby="install-title" class="reveal mt-10 rounded-[2rem] border border-white/10 p-6 sm:p-10">
        <h2 id="install-title" class="font-heading text-2xl font-bold text-white">How to install an APK</h2>
        <p class="mt-2 text-slate-400">These apps are installed directly from this website instead of Google Play. It takes a minute:</p>
        <ol class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          ${[
            ['fa-download', 'Download', 'Tap <b class="text-white">Install</b> above on your Android phone and let the download finish.'],
            ['fa-folder-open', 'Open the file', 'Open it from your notifications or the <b class="text-white">Downloads</b> folder.'],
            ['fa-shield-halved', 'Allow the install', 'If asked, allow your browser or Files app to <b class="text-white">install unknown apps</b> (Settings → Apps → Special access).'],
            ['fa-circle-check', 'Install & open', 'Tap <b class="text-white">Install</b>, then <b class="text-white">Open</b>. Google Play Protect may scan the app first.'],
          ].map(([icon, title, text], i) => `<li class="glass rounded-2xl p-5">
            <span class="font-mono text-xs text-slate-400">0${i + 1}</span>
            <i class="fa-solid ${icon} mt-3 block text-xl text-emerald-400" aria-hidden="true"></i>
            <h3 class="mt-3 font-heading text-lg font-bold text-white">${title}</h3>
            <p class="mt-1 text-sm leading-relaxed text-slate-400">${text}</p>
          </li>`).join('\n          ')}
        </ol>
      </section>`;

export function downloadsPage() {
  const file = 'downloads.html';
  const description = `Download ${APPS.map((a) => a.name).join(', ')} — free Android ${APPS.length > 1 ? 'apps' : 'app'} by Nipun Mitra. ${APPS[0].tagline}. Direct APK download for ${APPS[0].minAndroid}.`;
  const facts = APPS.map((a) => ({ a, f: fileFacts(a) }));
  return {
    file,
    active: 'downloads',
    title: `Downloads: ${APPS.map((a) => a.name).join(', ')} for Android | Nipun Mitra`,
    description,
    jsonLd: {
      '@graph': [
        { '@type': 'CollectionPage', '@id': `${canonicalFor(file)}#webpage`, url: canonicalFor(file), name: 'Downloads', description, isPartOf: { '@id': `${SITE}/#website` }, inLanguage: 'en' },
        ...facts.map(({ a, f }) => ({
          '@type': 'SoftwareApplication',
          '@id': `${canonicalFor(file)}#${a.id}`,
          name: a.name,
          description: a.description.join(' '),
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Android 7.0+',
          softwareVersion: a.version,
          fileSize: f.size,
          datePublished: a.updated,
          downloadUrl: `${SITE}/${a.apk}`,
          installUrl: `${SITE}/${a.apk}`,
          image: `${SITE}/${a.icon}`,
          url: `${canonicalFor(file)}#${a.id}`,
          author: { ...person(), '@type': 'Person', name: 'Nipun Mitra' },
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        })),
        breadcrumbs([['Home', 'index.html'], ['Downloads', file]]),
      ],
    },
    main: `
    <section class="px-4 pb-24 pt-36">
      <div class="mx-auto max-w-6xl">
        <div class="reveal mb-10">
          <p class="font-mono text-sm text-nebula-cyan">Downloads</p>
          <h1 class="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">My <span class="text-gradient">apps</span></h1>
          <p class="mt-4 max-w-2xl text-lg text-slate-400">Apps I’ve built — free to download and install on your Android phone.</p>
        </div>
${APPS.map(appDetail).join('\n')}
${installHelp}
      </div>
    </section>`,
  };
}
