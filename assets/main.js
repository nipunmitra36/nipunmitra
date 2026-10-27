// Shared behaviour for every page. Each block only runs if its elements exist on the page.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const finePointer = window.matchMedia('(pointer: fine)').matches; // mouse/trackpad (not touch)

/* ---------- Smooth scroll ----------
   Only for mouse wheels — touch scrolling is already smooth, and skipping it saves main-thread work on phones. */
let lenis = null;
if (window.Lenis && !reduceMotion && finePointer) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
}
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { offset: -90, duration: 1.4 });
  else target.scrollIntoView({ behavior: 'smooth' });
}));

/* ---------- Starfield ---------- */
(() => {
  const c = document.getElementById('space');
  const ctx = c.getContext('2d');
  // Fewer stars and a lower pixel ratio on phones keep the animation cheap.
  const dpr = Math.min(devicePixelRatio, finePointer ? 2 : 1.5);
  let w, h, stars = [];
  const colors = ['#ffffff', '#c4b5fd', '#a5f3fc', '#fbcfe8'];

  function resize() {
    w = c.width = innerWidth * dpr;
    h = c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    const count = Math.min(finePointer ? 300 : 140, Math.floor(innerWidth * innerHeight / 4500));
    stars = Array.from({ length: count }, () => {
      const blink = Math.random() < .22;
      return {
        x: Math.random() * w, y: Math.random() * h,
        z: Math.random() * 3 + .3,
        r: Math.random() * 1.2 + .2,
        t: Math.random() * Math.PI * 2,
        s: blink ? .02 + Math.random() * .035 : .008 + Math.random() * .018,
        blink,
        col: colors[Math.floor(Math.random() * colors.length)],
      };
    });
  }
  // Resizing clears the canvas, so repaint straight away if the animation loop isn't running.
  addEventListener('resize', () => { resize(); if (!started || reduceMotion) draw(last + 32); }); resize();
  // Stars stay put; most twinkle, some blink on and off with a little sparkle.
  // Twinkling is slow, so ~30 fps looks identical to 60 fps at half the cost.
  let last = 0;
  function draw(now = 0) {
    if (now - last < 32) { requestAnimationFrame(draw); return; }
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.t += s.s;
      const v = .5 + Math.sin(s.t) * .5;
      const a = s.blink ? Math.pow(v, 4) : .12 + v * .88;
      const r = s.r * s.z * dpr * .6 * (s.blink ? 1 + a * .7 : 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
      if (s.blink && a > .5 && s.r * s.z > 1.2) {
        const len = r * 5 * a;
        ctx.strokeStyle = s.col; ctx.lineWidth = dpr * .7; ctx.globalAlpha = a * .8;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
        ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
        ctx.stroke();
      }
    }
    if (!reduceMotion && started) requestAnimationFrame(draw);
  }
  // Paint the stars once right away, then start twinkling after the page has loaded and gone idle.
  let started = false;
  draw(32);
  const start = () => { started = true; requestAnimationFrame(draw); };
  addEventListener('load', () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 600)));
})();

/* ---------- Scroll effects: planet parallax + timeline rocket ----------
   Batched into one animation frame: read layout first, then write styles,
   so the browser never has to recalculate layout mid-frame (no forced reflow). */
(() => {
  const planets = reduceMotion ? [] : [...document.querySelectorAll('.bg-planet')];
  const tl = document.getElementById('timeline');
  const fill = document.getElementById('trajectory-fill'), rocket = document.getElementById('rocket');
  if (!planets.length && !tl) return;
  let queued = false;
  function frame() {
    queued = false;
    // read
    const y = scrollY, vh = innerHeight;
    const r = tl && tl.getBoundingClientRect();
    // write
    for (const p of planets) p.style.translate = `0 ${y * +p.dataset.speed}px`;
    if (r) {
      const progress = Math.min(1, Math.max(0, (vh * .6 - r.top) / r.height));
      fill.style.height = (progress * 100) + '%';
      rocket.style.top = `calc(${progress * 100}% - 12px)`;
    }
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  schedule();
})();

/* ---------- Projects ---------- */
const grid = document.getElementById('project-grid');
if (grid) {

// Filters
const activeCls = 'filter-btn rounded-full bg-white px-5 py-2 text-sm font-semibold text-void';
const idleCls = 'filter-btn glass rounded-full px-5 py-2 text-sm text-slate-300 hover:text-white';
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.filter-btn').forEach(b => b.className = idleCls);
  btn.className = activeCls;
  const f = btn.dataset.filter;
  grid.querySelectorAll('.project-card').forEach(card => {
    card.style.display = (f === 'all' || card.dataset.cat === f) ? '' : 'none';
  });
  lenis?.resize();
}));

// Gentle 3D tilt
if (matchMedia('(hover: hover)').matches && !reduceMotion) {
  grid.addEventListener('mousemove', e => {
    const card = e.target.closest('.project-card'); if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(1000px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-4px)`;
  });
  grid.addEventListener('mouseout', e => {
    const card = e.target.closest('.project-card');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });
}
}

/* ---------- Reveal + counters + bars ---------- */
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  en.target.classList.add('in');
  en.target.querySelectorAll('.counter').forEach(el => {
    const to = +el.dataset.to, start = performance.now(), dur = 1200;
    (function step(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  });
  en.target.querySelectorAll('.lang-bar').forEach(b => b.style.width = b.dataset.w);
  io.unobserve(en.target);
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ---------- Astronaut guide ----------
   One astronaut floats beside the content and travels with the scroll: it holds a side of the screen
   while you read a section, then flies across to the other side on its way to the next section —
   tilting into the turn, jet-pack glowing while it moves, and gently bobbing when it's idle. */
(() => {
  const guide = document.getElementById('astro-guide');
  const sections = [...document.querySelectorAll('main > section, main > article')].filter((s) => s.offsetHeight > 200);
  if (!guide || reduceMotion || !sections.length) { guide?.remove(); return; }
  const body = guide.querySelector('.astro-body'), glow = guide.querySelector('.astro-glow');

  let rects = [], vw = 0, vh = 0, size = 0;
  const measure = () => {
    vw = innerWidth; vh = innerHeight; size = guide.offsetWidth;
    rects = sections.map((s) => { const r = s.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height }; });
    // Wide screens: the side margin fits the astronaut, so it can float in front (never over text).
    // Narrower screens: it drifts behind the content instead.
    guide.classList.toggle('front', (vw - 1152) / 2 >= size + 8);
  };
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);

  // Stand in the side margin next to the content column (max-w-6xl = 1152px).
  const sideX = (i) => {
    const gutter = Math.max(0, (vw - 1152) / 2);
    const inset = gutter > size + 24 ? gutter / 2 - size / 2 : 8;
    return i % 2 === 0 ? inset : vw - size - inset;
  };
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const target = () => {
    const mid = scrollY + vh * 0.5;
    let i = rects.findIndex((r) => r.top + r.height > mid);
    if (i < 0) i = rects.length - 1;
    const r = rects[i];
    const p = clamp((mid - r.top) / r.height, 0, 1);
    const fly = i < rects.length - 1 ? smooth(0.7, 1, p) : 0; // cross over in the last 30% of a section
    const x = sideX(i) + (sideX(i + 1) - sideX(i)) * fly;
    const y = vh * (0.32 + 0.22 * Math.sin(p * Math.PI)) - Math.sin(fly * Math.PI) * vh * 0.12; // arc up while crossing
    // Home hero: start big like the hero's own astronaut, shrinking to guide size through the hero.
    const scale = isHome && i === 0 ? 2 - smooth(0.5, 0.95, p) : 1; // p ≈ 0.5 at the top of the page
    return [x, y, scale];
  };

  // On the home page the hero's astronaut becomes the guide.
  const isHome = !!document.querySelector('[data-astro-hero]');
  document.querySelector('[data-astro-hero]')?.classList.add('astro-handoff');

  let [x, y, scale] = target(), face = 1, lastScroll = scrollY, vel = 0;
  const t0 = performance.now();
  guide.classList.add('on');

  (function frame(now) {
    const [tx, ty, ts] = target();
    scale += (ts - scale) * 0.08;
    x += (tx - x) * 0.06; // ease towards the target: floaty, never snappy
    y += (ty - y) * 0.06;
    vel += (scrollY - lastScroll - vel) * 0.15;
    lastScroll = scrollY;

    const t = (now - t0) / 1000, dx = tx - x;
    const bob = Math.sin(t * 1.1) * 10, sway = Math.sin(t * 0.7) * 6;
    face += ((x + size / 2 < vw / 2 ? 1 : -1) - face) * 0.08; // always faces the content, turning smoothly
    const tilt = sway + clamp(dx * 0.08, -28, 28) + clamp(vel * 0.5, -14, 14);

    guide.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px, 0)`;
    body.style.transform = `scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg) scaleX(${face.toFixed(3)})`;
    glow.style.opacity = clamp(Math.abs(dx) / 140 + Math.abs(vel) / 45, 0, 1).toFixed(2);
    guide.classList.toggle('flying', Math.abs(dx) > 40); // crossing the page: pass behind the content
    requestAnimationFrame(frame);
  })(t0);
})();

/* ---------- Mobile menu ---------- */
const menu = document.getElementById('mobile-menu');
const menuBtn = document.getElementById('menu-btn');
menuBtn.addEventListener('click', () => menuBtn.setAttribute('aria-expanded', String(!menu.classList.toggle('hidden'))));
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.classList.add('hidden'); menuBtn.setAttribute('aria-expanded', 'false'); }));

/* ---------- Contact form (sent through FormSubmit, see contact section) ---------- */
(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('form-status');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector('[data-label]'), icon = btn.querySelector('[data-icon]');
  const EMAIL = 'nipunmitra03@gmail.com', WA = 'https://wa.me/8801761227436';
  const styles = {
    ok: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    info: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    error: 'border-red-400/30 bg-red-400/10 text-red-200',
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const show = (kind, html) => {
    status.className = 'rounded-xl border px-4 py-3 text-sm leading-relaxed ' + styles[kind];
    status.innerHTML = html;
  };

  // Ready-made WhatsApp / email links carrying what the visitor typed, so nothing is lost if sending fails.
  const fallback = (d) => {
    const text = `Hi Nipun, I'm ${d.name} (${d.email}).${d.subject ? `\nSubject: ${d.subject}` : ''}\n\n${d.message}`;
    const btn = 'mt-3 mr-2 inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold';
    return `<div>
      <a href="${WA}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" class="${btn} bg-[#25D366] text-[#052e16]"><i class="fa-brands fa-whatsapp"></i> Send via WhatsApp</a>
      <a href="mailto:${EMAIL}?subject=${encodeURIComponent(d.subject || `Hello from ${d.name}`)}&body=${encodeURIComponent(text)}" class="${btn} bg-white/10 text-white"><i class="fa-solid fa-envelope"></i> Send by email</a>
    </div>`;
  };
  const busy = (on) => {
    btn.disabled = on;
    label.textContent = on ? 'Sending…' : 'Send message';
    icon.className = on ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-paper-plane transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data._honey) return; // bot
    const visitor = { name: data.name, email: data.email, subject: data.subject, message: data.message };
    if (data.subject) data._subject = `${data.subject} — from ${data.name}`;
    data._replyto = data.email;

    // FormSubmit only accepts messages from a real website, not a page opened from disk.
    if (location.protocol === 'file:') {
      show('info', `<i class="fa-solid fa-circle-info mr-2"></i>The form sends messages once the site is online — it can’t send from a page opened on your computer. You can send this message right now instead:${fallback(visitor)}`);
      return;
    }

    busy(true);
    try {
      const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && String(json.success) === 'true') {
        form.reset();
        show('ok', '<i class="fa-solid fa-circle-check mr-2"></i>Thanks! Your message has been sent — I’ll get back to you soon.');
        return;
      }
      const reason = String(json.message || `HTTP ${res.status}`);
      console.warn('Contact form:', reason);
      if (/activat/i.test(reason)) {
        // First-ever submission: FormSubmit emails the site owner an "Activate Form" link.
        show('info', `<i class="fa-solid fa-hourglass-half mr-2"></i>The contact form is being set up, so this message couldn’t be delivered yet. Please send it directly:${fallback(visitor)}`);
      } else {
        show('error', `<i class="fa-solid fa-triangle-exclamation mr-2"></i>Sorry, the message couldn’t be sent (${esc(reason)}). You can send it directly instead:${fallback(visitor)}`);
      }
    } catch (err) {
      console.warn('Contact form:', err);
      show('error', `<i class="fa-solid fa-triangle-exclamation mr-2"></i>Sorry, the message couldn’t be sent — please check your connection. You can send it directly instead:${fallback(visitor)}`);
    } finally {
      busy(false);
    }
  });
})();

