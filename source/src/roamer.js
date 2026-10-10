// A small neon diamond that travels with the visitor through the page:
// it parks at anchors in each section, follows the cursor a little,
// perches on hovered cards, lights up cards it passes and bursts on CTA clicks.
import * as THREE from 'three';
import { diamondGeometry, makeGlowTexture } from './hero.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const prFor = (w, h, budget) => Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(budget / Math.max(1, w * h))));
export function initRoamer({ getVelocity = () => 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'roamer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const mobile = () => window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const budget = 2.4e6;
  renderer.setPixelRatio(prFor(window.innerWidth, window.innerHeight, budget));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(prFor(W, H, budget));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(15)));
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  const toWorld = (sx, sy, out) => out.set(sx - W / 2, H / 2 - sy, 0);

  // ---------- diamond ----------
  const geo = diamondGeometry();
  const glowTex = makeGlowTexture();
  const dia = new THREE.Group();
  const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0b1670, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const edgesGeo = new THREE.EdgesGeometry(geo, 1);
  const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 1 }));
  const edges2 = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x3b4bff, transparent: true, opacity: 0.9 }));
  edges2.scale.setScalar(1.06);
  const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x36baf7, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  inner.scale.setScalar(1.6);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x2b3bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  halo.scale.setScalar(4.2);
  dia.add(halo, body, edges, edges2, inner);
  scene.add(dia);

  // ---------- trail + burst particles ----------
  const TRAIL = 36, BURST = 140, NP = TRAIL + BURST;
  const pPos = new Float32Array(NP * 3), pA = new Float32Array(NP), pS = new Float32Array(NP);
  const bVel = new Float32Array(BURST * 3), bLife = new Float32Array(BURST);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pS, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float uPx;
      void main(){ vA = alpha; gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; float a = smoothstep(0.5,0.0,d);
      gl_FragColor = vec4(mix(vec3(0.21,0.73,0.97), vec3(0.85,0.97,1.0), a), a*vA); }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  const trail = Array.from({ length: TRAIL }, () => new THREE.Vector3());

  // ---------- state ----------
  const pos = new THREE.Vector3(-W, H, 0), vel = new THREE.Vector3(), target = new THREE.Vector3(), tmp = new THREE.Vector3();
  let scale = 0, scaleTarget = 1, spin = 0, spinBoost = 0, visible = 0, heroP = 0, t = 0, flash = 0;
  const mouse = { x: W / 2, y: H / 2, has: false };
  let hoverCard = null;
  const anchors = [...document.querySelectorAll('.dia-anchor')];
  const cards = [...document.querySelectorAll('.card')];
  const glow = new Map();

  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; }, { passive: true });
  if (window.matchMedia('(hover: hover)').matches) {
    cards.forEach((c) => {
      c.addEventListener('pointerenter', () => { hoverCard = c; spinBoost = Math.max(spinBoost, 6); });
      c.addEventListener('pointerleave', () => { if (hoverCard === c) hoverCard = null; });
    });
  }
  document.querySelectorAll('.btn-aurora').forEach((b) => b.addEventListener('click', () => burst()));

  function burst() {
    if (visible < 0.5) return;
    flash = 1; spinBoost = 14;
    for (let i = 0; i < BURST; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI, s = 120 + Math.random() * 380;
      bVel[i * 3] = Math.cos(a) * Math.cos(e) * s; bVel[i * 3 + 1] = Math.sin(e) * s; bVel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s;
      const j = (TRAIL + i) * 3; pPos[j] = pos.x; pPos[j + 1] = pos.y; pPos[j + 2] = pos.z;
      bLife[i] = 0.7 + Math.random() * 0.6;
    }
  }

  function pickAnchor() {
    let best = null, bestD = Infinity;
    for (const a of anchors) {
      const r = a.getBoundingClientRect();
      if (r.width === 0 && r.height === 0 && !a.offsetParent) continue;
      const d = Math.abs(r.top - H * 0.45);
      if (d < bestD) { bestD = d; best = { a, r }; }
    }
    return best;
  }

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const show = heroP > 0.55 ? 1 : 0;
    visible = lerp(visible, show, 1 - Math.exp(-dt * 5));
    if (visible < 0.01 && show === 0) {
      if (scale !== 0) { scale = 0; renderer.clear(); }
      cards.forEach((c) => { if (glow.get(c)) { c.style.setProperty('--dg', 0); glow.set(c, 0); } });
      return;
    }
    const m = mobile();
    const base = m ? 22 : 34;

    // ---- target
    let perched = false;
    if (hoverCard) {
      const r = hoverCard.getBoundingClientRect();
      if (r.bottom > 0 && r.top < H) {
        toWorld(r.right - base * 1.6, r.top - base * 0.35, target);
        scaleTarget = 0.7; perched = true;
      } else hoverCard = null;
    }
    if (!perched) {
      const pick = pickAnchor();
      if (pick) {
        const sy = clamp(pick.r.top, 90, H - 90);
        toWorld(pick.r.left, sy, target);
        scaleTarget = +(pick.a.dataset.scale || 1);
      }
      if (mouse.has && !m) { target.x += (mouse.x - W / 2) * 0.05; target.y -= (mouse.y - H / 2) * 0.05; }
      target.y += Math.sin(t * 1.6) * 8;
      target.x += Math.cos(t * 1.1) * 5;
    }

    // ---- spring motion
    const k = perched ? 90 : 38, damp = perched ? 14 : 9;
    tmp.copy(target).sub(pos).multiplyScalar(k * dt);
    vel.add(tmp).multiplyScalar(Math.exp(-damp * dt));
    pos.addScaledVector(vel, dt);
    scale = lerp(scale, scaleTarget * visible, 1 - Math.exp(-dt * 6));
    const sv = getVelocity();
    spinBoost = lerp(spinBoost, 0, 1 - Math.exp(-dt * 1.8));
    spin += dt * (1.2 + spinBoost + Math.min(Math.abs(sv) * 0.15, 8));

    dia.position.copy(pos);
    dia.scale.setScalar(base * scale * (1 + flash * 0.35));
    dia.rotation.set(0.42 + clamp(vel.y * 0.0012, -0.5, 0.5), spin, clamp(-vel.x * 0.0012, -0.6, 0.6));
    flash = lerp(flash, 0, 1 - Math.exp(-dt * 4));
    inner.material.opacity = 0.5 + flash * 0.8 + (perched ? 0.25 : 0);
    halo.material.opacity = (0.3 + flash * 0.5) * visible;
    edges.material.opacity = edges2.material.opacity = visible;
    body.material.opacity = 0.6 * visible;

    // ---- trail
    trail.unshift(trail.pop().copy(pos));
    const speed = vel.length();
    const trailA = clamp(speed / 600, 0, 1) * visible;
    for (let i = 0; i < TRAIL; i++) {
      pPos.set([trail[i].x + (Math.random() - 0.5) * 3, trail[i].y + (Math.random() - 0.5) * 3, trail[i].z], i * 3);
      const f = 1 - i / TRAIL;
      pA[i] = f * f * trailA * 0.9;
      pS[i] = (m ? 6 : 9) * f + 1;
    }
    for (let i = 0; i < BURST; i++) {
      const j = TRAIL + i;
      if (bLife[i] > 0) {
        bLife[i] -= dt;
        const d = Math.exp(-dt * 2.6);
        bVel[i * 3] *= d; bVel[i * 3 + 1] *= d; bVel[i * 3 + 2] *= d;
        pPos[j * 3] += bVel[i * 3] * dt; pPos[j * 3 + 1] += bVel[i * 3 + 1] * dt; pPos[j * 3 + 2] += bVel[i * 3 + 2] * dt;
        pA[j] = clamp(bLife[i], 0, 1); pS[j] = 5;
      } else pA[j] = 0;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;

    // ---- light up cards near the diamond
    const sx = pos.x + W / 2, sy = H / 2 - pos.y;
    // read all rects first, then write, so the browser lays out once per frame
    const rects = cards.map((c) => c.getBoundingClientRect());
    cards.forEach((c, k) => {
      const r = rects[k];
      let g = 0;
      if (r.bottom > -50 && r.top < H + 50) {
        const dx = Math.max(r.left - sx, 0, sx - r.right), dy = Math.max(r.top - sy, 0, sy - r.bottom);
        g = clamp(1 - Math.hypot(dx, dy) / 200, 0, 1) * visible;
        if (c === hoverCard) g = 1;
      }
      const prev = glow.get(c) || 0;
      const nv = lerp(prev, g, 0.15);
      if (Math.abs(nv - prev) > 0.004) { c.style.setProperty('--dg', nv.toFixed(3)); glow.set(c, nv); }
      if (g > 0.05 && c !== hoverCard) {
        c.style.setProperty('--mx', `${Math.round(sx - r.left)}px`); c.style.setProperty('--my', `${Math.round(sy - r.top)}px`);
      }
    });

    pMat.uniforms.uPx.value = renderer.getPixelRatio();
    renderer.render(scene, camera);
  }
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);

  return { setHero(p) { heroP = p; }, burst };
}
