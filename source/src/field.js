// Ambient particle field behind every section after the hero.
// The same dots that built the globe keep morphing into a new shape per section:
// Earth horizon → constellation network → VPN tunnel → diamond → small globe.
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { decodeLand, diamondGeometry } from './hero.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function initField({ reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'bg-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const mobile = window.innerWidth < 760;
  const N = mobile ? 1800 : 3600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 12000);
  let W = 1, H = 1, camZ = 1;

  // ---------- particle buffers ----------
  const pos = new Float32Array(N * 3), from = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const alpha = new Float32Array(N), fromA = new Float32Array(N), size = new Float32Array(N), delay = new Float32Array(N), push = new Float32Array(N);
  for (let i = 0; i < N; i++) { size[i] = 2.2 + Math.random() * 2.4; delay[i] = Math.random() * 0.55; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uPx: { value: renderer.getPixelRatio() }, uCam: { value: 1 } },
    vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float uPx; uniform float uCam;
      void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = clamp(size * 1.6 * uPx * (uCam / -mv.z), 0.0, 22.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard;
      float core = smoothstep(0.22, 0.0, d); float glow = smoothstep(0.5, 0.0, d) * 0.45;
      gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.35), (core + glow) * vA); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // ---------- shape library (local coordinates, unit-ish) ----------
  const isLand = decodeLand();
  function spherePoints(n, landShare) {
    const land = [], sea = [];
    const C = n * 6, g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < C; i++) {
      const y = 1 - (i / (C - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      const lat = Math.asin(y) * 180 / Math.PI, lon = Math.atan2(z, x) * 180 / Math.PI;
      (isLand(lat, -lon) ? land : sea).push(x, y, z);
    }
    const out = new Float32Array(n * 3), br = new Float32Array(n);
    const nl = Math.round(n * landShare);
    for (let i = 0; i < n; i++) {
      const src = i < nl ? land : sea, k = ((Math.random() * (src.length / 3)) | 0) * 3;
      out[i * 3] = src[k]; out[i * 3 + 1] = src[k + 1]; out[i * 3 + 2] = src[k + 2];
      br[i] = i < nl ? 0.75 + Math.random() * 0.25 : 0.18;
    }
    return { p: out, b: br };
  }
  const sphere = spherePoints(N, 0.78);
  // horizon: the top of a huge dotted planet rising from the bottom of the screen (front half only)
  const cap = new Float32Array(N * 3), capLat = new Float32Array(N), capLon = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = 0.72 + Math.random() * 0.28, r = Math.sqrt(1 - y * y), ph = Math.random() * Math.PI;
    cap[i * 3] = r * Math.cos(ph); cap[i * 3 + 1] = y; cap[i * 3 + 2] = r * Math.sin(ph);
    capLat[i] = Math.asin(y) * 180 / Math.PI - 38;
    capLon[i] = -Math.atan2(cap[i * 3 + 2], cap[i * 3]) * 180 / Math.PI * 2.2;
  }
  // constellation: clusters of dots
  const net = new Float32Array(N * 3), netB = new Float32Array(N);
  const CL = mobile ? 9 : 16, centers = [];
  for (let c = 0; c < CL; c++) centers.push([(Math.random() - 0.5) * 1.9, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 0.6, 0.03 + Math.random() * 0.07]);
  for (let i = 0; i < N; i++) {
    if (i % 5 === 0) { // links: dots strung between neighbouring clusters
      const a = centers[i % CL], b = centers[(i * 7 + 3) % CL], u = Math.random();
      net[i * 3] = a[0] + (b[0] - a[0]) * u; net[i * 3 + 1] = a[1] + (b[1] - a[1]) * u; net[i * 3 + 2] = a[2] + (b[2] - a[2]) * u;
      netB[i] = 0.28;
    } else {
      const c = centers[i % CL], g = () => (Math.random() + Math.random() + Math.random() - 1.5) * c[3] * 1.6;
      net[i * 3] = c[0] + g(); net[i * 3 + 1] = c[1] + g(); net[i * 3 + 2] = c[2] + g();
      netB[i] = 0.5 + Math.random() * 0.5;
    }
  }

  // tunnel: rings
  const RINGS = 30, tunnelA = new Float32Array(N), tunnelZ = new Float32Array(N), tunnelR = new Float32Array(N);
  for (let i = 0; i < N; i++) { const ring = i % RINGS; tunnelZ[i] = ring / RINGS; tunnelA[i] = Math.random() * Math.PI * 2; tunnelR[i] = 1 + (Math.random() - 0.5) * 0.12; }

  // diamond: surface + edges
  const dGeo = diamondGeometry();
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(dGeo)).build();
  const edgesArr = new THREE.EdgesGeometry(dGeo, 1).attributes.position.array;
  const dia = new Float32Array(N * 3), diaB = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      const s = ((Math.random() * (edgesArr.length / 6)) | 0) * 6, u = Math.random();
      dia[i * 3] = edgesArr[s] + (edgesArr[s + 3] - edgesArr[s]) * u;
      dia[i * 3 + 1] = edgesArr[s + 1] + (edgesArr[s + 4] - edgesArr[s + 1]) * u;
      dia[i * 3 + 2] = edgesArr[s + 2] + (edgesArr[s + 5] - edgesArr[s + 2]) * u;
      diaB[i] = 0.9;
    } else { sampler.sample(v); dia.set([v.x, v.y, v.z], i * 3); diaB[i] = 0.22; }
  }

  // drifting field
  const drift = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { drift[i * 3] = Math.random() - 0.5; drift[i * 3 + 1] = Math.random(); drift[i * 3 + 2] = Math.random(); }

  const cLand = new THREE.Color(0xbff3ff), cSea = new THREE.Color(0x3b4bff), cCyan = new THREE.Color(0x36baf7), cTeal = new THREE.Color(0x00d7c0), cLav = new THREE.Color(0x9aa2ff);
  const tc = new THREE.Color();

  // Each shape writes world position, alpha and colour for particle i at time t.
  const m4 = new THREE.Matrix4(), e3 = new THREE.Euler();
  const SHAPES = {
    horizon: {
      prep() {},
      get(i, t, o) {
        const R = Math.max(W * 0.95, H * 1.2);
        const x = cap[i * 3], y = cap[i * 3 + 1], z = cap[i * 3 + 2];
        o.x = x * R; o.y = y * R - R - H * 0.2; o.z = z * R * 0.22 - 60;
        const land = isLand(capLat[i], ((capLon[i] + t * 5 + 540) % 360) - 180);
        const rim = 1 - smooth(0.0, 0.22, z);            // limb glows
        o.a = (land ? 0.9 : 0.12) + rim * 0.55;
        tc.copy(land ? cLand : cSea).lerp(cCyan, rim * 0.7);
      },
    },
    network: {
      prep() {},
      get(i, t, o) {
        o.x = net[i * 3] * W * 0.52 + Math.sin(t * 0.3 + i) * 6;
        o.y = net[i * 3 + 1] * H * 0.5 + Math.cos(t * 0.25 + i * 0.7) * 6;
        o.z = net[i * 3 + 2] * 600;
        o.a = netB[i] * 0.9 * (0.75 + 0.25 * Math.sin(t * 2 + i));
        tc.copy(i % 3 === 0 ? cTeal : cCyan).lerp(cLand, netB[i] * 0.5);
      },
    },
    tunnel: { // orbits: tilted rings of dots with travelling bright segments
      prep() {},
      get(i, t, o) {
        const ring = i % 5, k = tunnelZ[i];
        const Rr = Math.max(W, H * 1.4) * (0.24 + ring * 0.085) * tunnelR[i] ** 0.15;
        const sp = (ring % 2 ? -1 : 1) * (0.12 + ring * 0.025);
        const ang = tunnelA[i];
        const tilt = 0.32 + ring * 0.07, roll = (ring - 2) * 0.13 + Math.sin(t * 0.15 + ring) * 0.04;
        const x = Math.cos(ang) * Rr, z = Math.sin(ang) * Rr;
        const y2 = -z * Math.sin(tilt), z3 = z * Math.cos(tilt);
        const x3 = x * Math.cos(roll) - y2 * Math.sin(roll), y3 = x * Math.sin(roll) + y2 * Math.cos(roll);
        o.x = x3; o.y = y3 + H * 0.02; o.z = z3 - 300;
        const head = (((ang - t * sp * 6) / (Math.PI * 2)) % 1 + 1) % 1;
        const comet = Math.pow(1 - head, 6);
        o.a = (0.3 + comet * 1.1) * smooth(-Rr * 1.2, Rr * 0.2, z3) + 0.04 * k;
        tc.copy(cSea).lerp(cLand, comet);
      },
    },
    diamond: {
      prep(t) { e3.set(0.35, t * 0.25, 0); m4.makeRotationFromEuler(e3); },
      get(i, t, o) {
        const S = Math.min(H * 0.42, W * 0.36);
        v.set(dia[i * 3], dia[i * 3 + 1], dia[i * 3 + 2]).applyMatrix4(m4);
        o.x = v.x * S; o.y = v.y * S + H * 0.02; o.z = v.z * S - 200;
        o.a = diaB[i] * 0.95;
        tc.copy(diaB[i] > 0.5 ? cLand : cSea).lerp(cLav, 0.2);
      },
    },
    globe: {
      prep(t) { e3.set(0.3, t * 0.12, 0.2); m4.makeRotationFromEuler(e3); },
      get(i, t, o) {
        const R = Math.min(H * 0.36, W * 0.42);
        v.set(sphere.p[i * 3], sphere.p[i * 3 + 1], sphere.p[i * 3 + 2]).applyMatrix4(m4);
        o.x = v.x * R; o.y = v.y * R; o.z = v.z * R - 150;
        o.a = sphere.b[i] * (0.2 + 0.8 * smooth(-0.3, 0.5, v.z));
        tc.copy(sphere.b[i] > 0.5 ? cLand : cSea);
      },
    },
    drift: {
      prep() {},
      get(i, t, o) {
        o.x = drift[i * 3] * W * 1.1;
        o.y = (((drift[i * 3 + 1] + t * 0.01) % 1) - 0.5) * H * 1.1;
        o.z = -drift[i * 3 + 2] * 900;
        o.a = 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
        tc.copy(cCyan).lerp(cLand, drift[i * 3 + 2]);
      },
    },
  };

  // ---------- section → shape ----------
  const sections = [...document.querySelectorAll('[data-field]')];
  let current = 'horizon', t0 = -10, t = 0, inHero = true;
  const mouse = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX - W / 2; mouse.y = H / 2 - e.clientY; }, { passive: true });

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camZ = (H / 2) / Math.tan(THREE.MathUtils.degToRad(15));
    camera.position.set(0, 0, camZ);
    camera.updateProjectionMatrix();
    mat.uniforms.uCam.value = camZ;
  }
  resize();
  window.addEventListener('resize', resize);

  function pickShape() {
    const mid = H * 0.5;
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) return s.dataset.field; }
    return current;
  }

  // start in horizon formation
  const o = { x: 0, y: 0, z: 0, a: 0 };
  SHAPES.horizon.prep(0);
  for (let i = 0; i < N; i++) { SHAPES.horizon.get(i, 0, o); pos.set([o.x, o.y, o.z], i * 3); alpha[i] = o.a; col.set([tc.r, tc.g, tc.b], i * 3); }

  const clock = new THREE.Clock();
  let qFrames = 0, qSlow = 0, qLow = false;
  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (inHero) return;
    if (!qLow && rawDt < 0.5) {
      qFrames++; if (rawDt > 0.026) qSlow++;
      if (qFrames >= 120) {
        if (qSlow > 45 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); qLow = true; }
        qFrames = qSlow = 0;
      }
    }
    t += reduced ? 0 : dt;
    const want = pickShape();
    if (want !== current) {
      from.set(pos); fromA.set(alpha);
      current = want; t0 = t;
    }
    const S = SHAPES[current];
    S.prep(t);
    const since = t - t0;
    window.__field = { current, since };
    for (let i = 0; i < N; i++) {
      S.get(i, t, o);
      const u = reduced ? 1 : ease(clamp((since - delay[i]) / 1.5));
      let x, y, z, a;
      if (u < 1) {
        const sw = Math.sin(u * Math.PI) * 60;
        x = from[i * 3] + (o.x - from[i * 3]) * u + sw * Math.sin(i);
        y = from[i * 3 + 1] + (o.y - from[i * 3 + 1]) * u + sw * Math.cos(i);
        z = from[i * 3 + 2] + (o.z - from[i * 3 + 2]) * u;
        a = fromA[i] + (o.a - fromA[i]) * u;
        const j = i * 3;
        col[j] += (tc.r - col[j]) * 0.08; col[j + 1] += (tc.g - col[j + 1]) * 0.08; col[j + 2] += (tc.b - col[j + 2]) * 0.08;
      } else {
        x = o.x; y = o.y; z = o.z; a = o.a;
        col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b;
      }
      // cursor: particles near the pointer drift away and brighten
      const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
      const target = d2 < 22500 ? (1 - Math.sqrt(d2) / 150) : 0;
      push[i] += (target - push[i]) * 0.1;
      if (push[i] > 0.002) { const d = Math.sqrt(d2) || 1; x += (dx / d) * push[i] * 40; y += (dy / d) * push[i] * 40; a += push[i] * 0.5; }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; alpha[i] = a;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    setHero(p) {
      const was = inHero;
      inHero = p < 0.35;
      canvas.style.opacity = clamp((p - 0.35) / 0.4).toFixed(3);
      if (was && !inHero) clock.getDelta();
    },
  };
}
