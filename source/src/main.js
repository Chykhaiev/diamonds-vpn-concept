import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHero } from './hero.js';
import { initRoamer } from './roamer.js';
import { initField } from './field.js';

gsap.registerPlugin(ScrollTrigger); window.ST = ScrollTrigger;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : el, { offset: -70, duration: 1.4 });
    else el.scrollIntoView();
  });
});

// ---------- split headings into words ----------
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.textContent = part; w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return el.querySelectorAll('.w > span');
}

// ---------- hero ----------
const heroTitle = document.querySelector('.hero-title');
heroTitle.classList.add('split');
const heroWords = splitWords(heroTitle);
const heroBits = [document.querySelector('.hero-eyebrow'), document.querySelector('.hero-lead'), document.querySelector('.hero-actions')];
gsap.set(heroWords, { yPercent: 110 });
gsap.set(heroBits, { autoAlpha: 0, y: 16 });
const replayBtn = document.querySelector('.replay');

function revealHero() {
  const tl = gsap.timeline();
  tl.to(heroBits[0], { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' })
    .to(heroWords, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, '<0.1')
    .to(heroBits.slice(1), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, '<0.35')
    .add(() => replayBtn.classList.add('show'), '<0.6');
}

const field = initField({ reduced });
const roamer = reduced ? null : initRoamer({ getVelocity: () => (lenis ? lenis.velocity : 0) });
const hero = initHero(document.querySelector('.hero-canvas'), { reducedMotion: reduced, onReady: revealHero });
replayBtn.addEventListener('click', () => {
  replayBtn.classList.remove('show');
  gsap.to(heroBits, { autoAlpha: 0, y: 16, duration: 0.4 });
  gsap.to(heroWords, { yPercent: 110, duration: 0.5, ease: 'power2.in' });
  if (lenis) lenis.scrollTo(0, { immediate: true });
  setTimeout(() => hero.replay(), 350);
});

ScrollTrigger.create({
  trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
  onUpdate: (s) => { hero.setScroll(s.progress); field.setHero(s.progress); roamer && roamer.setHero(s.progress); },
  onLeave: () => { hero.pause(); field.setHero(1); roamer && roamer.setHero(1); },
  onEnterBack: () => hero.resume(),
});
gsap.to('.hero-content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });

// nav state
ScrollTrigger.create({ start: 80, onToggle: (s) => document.querySelector('.nav').classList.toggle('scrolled', s.isActive) });

if (!reduced) {
  // ---------- section headings ----------
  document.querySelectorAll('.split:not(.hero-title)').forEach((h) => {
    const words = splitWords(h);
    gsap.from(words, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  gsap.utils.toArray('.section-head .eyebrow, .section-head .lead, .cta .eyebrow').forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: 18, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // ---------- cards ----------
  const groups = ['.steps', '.bento', '.apps', '.plans', '.faq'];
  groups.forEach((g) => {
    const items = document.querySelectorAll(`${g} > *, ${g} .app-item`);
    gsap.from(items, { autoAlpha: 0, y: 48, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 82%' } });
  });
  gsap.from('.includes li', { autoAlpha: 0, y: 12, stagger: 0.06, duration: 0.6, scrollTrigger: { trigger: '.includes', start: 'top 92%' } });
  gsap.from('.stat', { autoAlpha: 0, y: 24, stagger: 0.08, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.stats', start: 'top 90%' } });

  // ---------- kinetic text ----------
  gsap.fromTo('.k1', { xPercent: 0 }, { xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.kinetic', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  gsap.fromTo('.k2', { xPercent: -35 }, { xPercent: -5, ease: 'none', scrollTrigger: { trigger: '.kinetic', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });

  // phone parallax
  gsap.fromTo('.phone', { y: 60, rotate: 4 }, { y: -40, rotate: -3, ease: 'none', scrollTrigger: { trigger: '.apps', start: 'top bottom', end: 'bottom top', scrub: true } });

  // cta + footer
  gsap.from('.cta .btn', { autoAlpha: 0, y: 20, duration: 0.8, scrollTrigger: { trigger: '.cta', start: 'top 70%' } });
  gsap.from('.footer-word', { yPercent: 40, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
}

// ---------- counters ----------
document.querySelectorAll('[data-count]').forEach((el) => {
  const end = +el.dataset.count;
  if (reduced || end === 0) { el.textContent = end; return; }
  const o = { v: 0 };
  gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 92%' }, onUpdate: () => (el.textContent = Math.round(o.v)) });
});

// ---------- FAQ: animate open/close ----------
document.querySelectorAll('.faq-item').forEach((d) => {
  const sum = d.querySelector('summary'), body = d.querySelector('.faq-body');
  sum.addEventListener('click', (e) => {
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, duration: 0.4, ease: 'power2.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
    } else {
      d.open = true;
      gsap.from(body, { height: 0, duration: 0.5, ease: 'power3.out' });
    }
  });
});

// ---------- locations ticker ----------
const locs = document.querySelectorAll('.locations span');
let li = 0;
setInterval(() => { locs.forEach((s, i) => s.classList.toggle('on', i === li)); li = (li + 1) % locs.length; }, 1400);

// ---------- pointer effects ----------
if (finePointer && !reduced) {
  const cur = document.querySelector('.cursor');
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3.out' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => { cur.classList.add('on'); xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('on'));
  document.querySelectorAll('a, button, summary, .app-item').forEach((el) => {
    el.addEventListener('pointerenter', () => cur.classList.add('hover'));
    el.addEventListener('pointerleave', () => cur.classList.remove('hover'));
  });

  // card spotlight
  document.querySelectorAll('.spot').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // magnetic buttons
  document.querySelectorAll('.magnetic').forEach((b) => {
    const bx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const by = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      bx((e.clientX - r.left - r.width / 2) * 0.25); by((e.clientY - r.top - r.height / 2) * 0.35);
    });
    b.addEventListener('pointerleave', () => { bx(0); by(0); });
  });

  // phone tilt
  const phone = document.querySelector('.phone');
  const app = document.querySelector('.app-main');
  app.addEventListener('pointermove', (e) => {
    const r = app.getBoundingClientRect();
    gsap.to(phone, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 16, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 12, transformPerspective: 800, duration: 0.6 });
  });
  app.addEventListener('pointerleave', () => gsap.to(phone, { rotateY: 0, rotateX: 0, duration: 0.8 }));
}

// ---------- molecule network ----------
initNetwork(document.querySelector('.net-canvas'));

function initNetwork(canvas) {
  const ctx = canvas.getContext('2d');
  const card = canvas.parentElement;
  let w = 0, h = 0, dpr = 1, nodes = [], visible = false;
  const mouse = { x: -999, y: -999 };
  function build() {
    dpr = Math.min(window.devicePixelRatio, 1.5);
    w = card.clientWidth; h = card.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 9000);
    nodes = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h * 0.75,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: i < 5 ? 5 : 1.4 + Math.random() * 1.6, hub: i < 5,
    }));
  }
  build();
  new ResizeObserver(build).observe(card);
  card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  card.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(card);
  const hubColors = ['#36baf7', '#3b4bff', '#00d7c0', '#cff4ff', '#9aa2ff'];
  let pulse = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    pulse += 0.012;
    ctx.clearRect(0, 0, w, h);
    for (const p of nodes) {
      if (!reduced) { p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h * 0.8) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 120 && d > 0) { p.x += (dx / d) * 1.2; p.y += (dy / d) * 1.2; }
    }
    const maxD = 130;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < maxD) {
          ctx.strokeStyle = `rgba(120,190,255,${(1 - d / maxD) * (a.hub || b.hub ? 0.5 : 0.22)})`;
          ctx.lineWidth = a.hub || b.hub ? 1 : 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    nodes.forEach((p, i) => {
      if (p.hub) {
        const c = hubColors[i % hubColors.length];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
        g.addColorStop(0, c + 'aa'); g.addColorStop(1, c + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(pulse * 3 + i) * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(207,244,255,.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  tick();
}
