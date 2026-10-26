// Shared behaviour for every page. Each block only runs if its elements exist on the page.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (window.Lenis && !reduceMotion) {
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
  const dpr = Math.min(devicePixelRatio, 2);
  let w, h, stars = [];
  const colors = ['#ffffff', '#c4b5fd', '#a5f3fc', '#fbcfe8'];

  function resize() {
    w = c.width = innerWidth * dpr;
    h = c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    const count = Math.min(380, Math.floor(innerWidth * innerHeight / 3800));
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
  addEventListener('resize', resize); resize();
  // Stars stay put; most twinkle, some blink on and off with a little sparkle.
  function draw() {
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
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  draw();
})();

/* ---------- Planet parallax ---------- */
(() => {
  const planets = [...document.querySelectorAll('.bg-planet')];
  function update() {
    const y = scrollY;
    planets.forEach(p => { p.style.translate = `0 ${y * +p.dataset.speed}px`; });
  }
  if (!reduceMotion) { addEventListener('scroll', update, { passive: true }); update(); }
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

/* ---------- Timeline rocket ---------- */
(() => {
  const tl = document.getElementById('timeline'), fill = document.getElementById('trajectory-fill'), rocket = document.getElementById('rocket');
  if (!tl) return;
  function update() {
    const r = tl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * .6 - r.top) / r.height));
    fill.style.height = (p * 100) + '%';
    rocket.style.top = `calc(${p * 100}% - 12px)`;
  }
  addEventListener('scroll', update, { passive: true }); update();
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
  const WA = 'https://wa.me/8801761227436';

  const show = (kind, html) => {
    status.className = 'rounded-xl border px-4 py-3 text-sm ' + (kind === 'ok'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : 'border-red-400/30 bg-red-400/10 text-red-200');
    status.innerHTML = html;
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
    if (data.subject) data._subject = `${data.subject} — from ${data.name}`;
    data._replyto = data.email;

    busy(true);
    try {
      const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || `HTTP ${res.status}`);
      form.reset();
      show('ok', '<i class="fa-solid fa-circle-check mr-2"></i>Thanks! Your message has been sent — I’ll get back to you soon.');
    } catch (err) {
      console.warn('Contact form:', err);
      show('error', `<i class="fa-solid fa-triangle-exclamation mr-2"></i>Sorry, the message couldn’t be sent. Please try again, or reach me on <a href="${WA}" target="_blank" rel="noopener" class="font-semibold underline">WhatsApp</a> or at <a href="mailto:nipunmitra03@gmail.com" class="font-semibold underline">nipunmitra03@gmail.com</a>.`);
    } finally {
      busy(false);
    }
  });
})();

