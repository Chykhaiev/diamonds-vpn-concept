// Hero scene: a neon diamond flies in, charges, explodes into particles,
// and the particles reassemble into a rotating particle Earth.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { LAND_W, LAND_H, LAND_B64 } from './landmask.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Timeline (seconds)
const T = { fly: 1.7, charge: 0.75, drift: 0.75, assemble: 1.9, spread: 0.7 };
const T_EXPLODE = T.fly + T.charge;
const T_ASSEMBLE = T_EXPLODE + T.drift;
const T_DONE = T_ASSEMBLE + T.assemble + T.spread;

export function decodeLand() {
  const bin = atob(LAND_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * LAND_W) % LAND_W;
    const y = Math.min(LAND_H - 1, Math.floor(((90 - lat) / 180) * LAND_H));
    const i = y * LAND_W + x;
    return (bytes[i >> 3] >> (i & 7)) & 1;
  };
}

export function diamondGeometry() {
  // Brilliant-cut silhouette, faceted by using few radial segments.
  const pts = [
    new THREE.Vector2(0.0001, -1.15),
    new THREE.Vector2(1.0, 0.0),
    new THREE.Vector2(0.98, 0.08),
    new THREE.Vector2(0.58, 0.48),
    new THREE.Vector2(0.0001, 0.48),
  ];
  const g = new THREE.LatheGeometry(pts, 10);
  g.computeVertexNormals();
  return g;
}

export function initHero(canvas, { onReady, reducedMotion = false } = {}) {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const N = isMobile ? 7000 : 13000;
  const R = isMobile ? 2.35 : 2.9;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.08);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Diamond ----------
  const dGeo = diamondGeometry();
  const diamond = new THREE.Group();
  const body = new THREE.Mesh(dGeo, new THREE.MeshBasicMaterial({ color: 0x0a1460, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(dGeo, 1), new THREE.LineBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.95 }));
  const edges2 = new THREE.LineSegments(new THREE.EdgesGeometry(dGeo, 1), new THREE.LineBasicMaterial({ color: 0x3b4bff, transparent: true, opacity: 0.9 }));
  edges2.scale.setScalar(1.035);
  diamond.add(body, edges, edges2);
  // inner core glow
  const glowTex = makeGlowTexture();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x3b6bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  core.scale.setScalar(1.8);
  diamond.add(core);
  scene.add(diamond);

  // shockwave ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0x9be9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(ring);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcff6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  scene.add(flash);

  // ---------- Globe targets ----------
  const isLand = decodeLand();
  const globe = new THREE.Group();
  globe.rotation.z = 0.32;
  scene.add(globe);

  const landPts = [], oceanPts = [];
  const CAND = isMobile ? 26000 : 42000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < CAND; i++) {
    const y = 1 - (i / (CAND - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const lat = Math.asin(y) * 180 / Math.PI;
    const lon = Math.atan2(z, x) * 180 / Math.PI;
    (isLand(lat, -lon) ? landPts : oceanPts).push([x, y, z]);
  }
  shuffle(landPts); shuffle(oceanPts);
  const nLand = Math.min(landPts.length, Math.round(N * 0.74));
  const nOcean = N - nLand;
  const target = new Float32Array(N * 3); // local, on sphere
  const kind = new Uint8Array(N); // 1 land, 0 ocean
  for (let i = 0; i < N; i++) {
    const src = i < nLand ? landPts[i] : oceanPts[(i - nLand) % oceanPts.length];
    const lift = i < nLand ? 1.0 : 0.985;
    target[i * 3] = src[0] * R * lift; target[i * 3 + 1] = src[1] * R * lift; target[i * 3 + 2] = src[2] * R * lift;
    kind[i] = i < nLand ? 1 : 0;
  }

  // ---------- Particles ----------
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const from = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const delay = new Float32Array(N);
  const push = new Float32Array(N); // cursor push amount
  const cDiamondA = new THREE.Color(0x9be9ff), cDiamondB = new THREE.Color(0x3b4bff), cLand = new THREE.Color(0xbff3ff), cLand2 = new THREE.Color(0x36baf7), cOcean = new THREE.Color(0x2b3bff);
  const startCol = new Float32Array(N * 3), endCol = new Float32Array(N * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    tmp.copy(cDiamondA).lerp(cDiamondB, Math.random() * 0.8);
    startCol.set([tmp.r, tmp.g, tmp.b], i * 3);
    if (kind[i]) tmp.copy(cLand).lerp(cLand2, Math.random() * 0.55); else tmp.copy(cOcean);
    endCol.set([tmp.r, tmp.g, tmp.b], i * 3);
    size[i] = kind[i] ? 1.1 + Math.random() * 0.9 : 0.6 + Math.random() * 0.4;
    // stagger: land assembles first, then ocean, with jitter
    const ty = target[i * 3 + 1] / R;
    delay[i] = (kind[i] ? 0 : 0.35) + (1 - Math.abs(ty)) * 0.12 + Math.random() * 0.45;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  pGeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: renderer.getPixelRatio() }, uScale: { value: 1 }, uNear: { value: -13 + R }, uFar: { value: -13 - R } },
    vertexShader: `
      attribute float size; attribute float alpha; varying vec3 vCol; varying float vA; uniform float uPx; uniform float uScale; uniform float uNear; uniform float uFar;
      void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        // fade the far hemisphere of the globe
        float depth = smoothstep(uFar + 0.6, uNear - 0.6, mv.z);
        vA = alpha * mix(0.18, 1.0, depth);
        gl_PointSize = size * uPx * uScale * (34.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if(d>0.5) discard;
        float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vCol, a * vA); }`,
    vertexColors: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  // globe atmosphere + ocean sphere (subtle) — revealed after assembly
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 64, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.5); gl_FragColor = vec4(0.3,0.65,1.0, f*uOpacity); }`,
  }));
  atmo.scale.setScalar(1.0);
  globe.add(atmo);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x2b3bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  halo.scale.setScalar(R * 4.2);
  scene.add(halo);

  // VPN route arcs between land points
  const arcs = buildArcs(globe, target, nLand, R, glowTex);

  // ---------- Interaction ----------
  const mouse = new THREE.Vector2(0, 0), mouseSmooth = new THREE.Vector2(0, 0);
  let mouseActive = false;
  const ray = new THREE.Raycaster();
  const hitSphere = new THREE.Sphere(new THREE.Vector3(), R);
  const hitPoint = new THREE.Vector3();
  let hasHit = false;
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseActive = true;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', () => { mouseActive = false; });

  // ---------- Resize ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.position.z = w / h < 0.8 ? 17 : 13;
    camera.updateProjectionMatrix();
    pMat.uniforms.uNear.value = -camera.position.z + R; pMat.uniforms.uFar.value = -camera.position.z - R;
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- Animation ----------
  const flyFrom = new THREE.Vector3(-11, 6.2, -3), flyCtrl = new THREE.Vector3(-4.5, 4.2, 2), flyTo = new THREE.Vector3(0, 0, 0);
  const sampler = new MeshSurfaceSampler(body).build();
  const sp = new THREE.Vector3(), q = new THREE.Vector3(), m4 = new THREE.Matrix4();
  let exploded = false, readyFired = false;
  const clock = new THREE.Clock();
  let t = reducedMotion ? T_DONE + 1 : 0;
  let scrollP = 0;
  let running = true;

  function explode() {
    exploded = true;
    diamond.updateMatrixWorld(true);
    m4.copy(body.matrixWorld);
    for (let i = 0; i < N; i++) {
      sampler.sample(sp); sp.applyMatrix4(m4);
      pos.set([sp.x, sp.y, sp.z], i * 3);
      q.copy(sp).normalize();
      const s = 3 + Math.random() * 7.5;
      vel[i * 3] = q.x * s + (Math.random() - 0.5) * 4;
      vel[i * 3 + 1] = q.y * s + (Math.random() - 0.5) * 4;
      vel[i * 3 + 2] = q.z * s + (Math.random() - 0.5) * 4;
      alpha[i] = 1;
      col.set(startCol.subarray(i * 3, i * 3 + 3), i * 3);
    }
    diamond.visible = false;
  }

  if (reducedMotion) { diamond.visible = false; exploded = true; }

  function quadBezier(a, b, c, u, out) {
    const iu = 1 - u;
    out.set(iu * iu * a.x + 2 * iu * u * b.x + u * u * c.x, iu * iu * a.y + 2 * iu * u * b.y + u * u * c.y, iu * iu * a.z + 2 * iu * u * b.z + u * u * c.z);
    return out;
  }

  const gm = new THREE.Matrix4(), wv = new THREE.Vector3(), nrm = new THREE.Vector3();
  // adaptive quality: if frames keep running slow, render at 1x pixel ratio
  let qFrames = 0, qSlow = 0, qLow = false;
  function frame() {
    if (!running) return;
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    if (!qLow && rawDt < 0.5) {
      qFrames++; if (rawDt > 0.026) qSlow++;
      if (qFrames >= 120) {
        if (qSlow > 45 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); qLow = true; }
        qFrames = qSlow = 0;
      }
    }
    t += dt; window.__heroT = t;
    mouseSmooth.lerp(mouse, 0.06);

    // ---- diamond phases
    if (!exploded) {
      if (t < T.fly) {
        const u = easeOutCubic(t / T.fly);
        quadBezier(flyFrom, flyCtrl, flyTo, u, diamond.position);
        diamond.scale.setScalar(0.25 + 0.75 * u);
        diamond.rotation.set(0.35 + (1 - u) * 2, t * 3.2, 0.25 * (1 - u));
        bloom.strength = 0.7;
      } else if (t < T_EXPLODE) {
        const u = (t - T.fly) / T.charge;
        const e = easeInCubic(u);
        diamond.position.set((Math.random() - 0.5) * 0.06 * e, (Math.random() - 0.5) * 0.06 * e, 0);
        diamond.scale.setScalar(1 + e * 0.75);
        diamond.rotation.y += dt * (3.2 + e * 14);
        core.material.opacity = 0.35 + e * 0.9;
        core.scale.setScalar(1.8 + e * 3.2);
        bloom.strength = 0.7 + e * 1.3;
      } else {
        explode();
        ring.material.opacity = 1;
      }
    }

    // ---- shockwave & flash
    const te = t - T_EXPLODE;
    if (te > 0 && te < 1.2) {
      const u = te / 1.2;
      ring.scale.setScalar(0.5 + easeOutCubic(u) * 9);
      ring.material.opacity = (1 - u) * 0.35;
      flash.scale.setScalar(2.5 + easeOutCubic(u) * 6);
      flash.material.opacity = Math.max(0, 0.55 - u * 1.6);
      bloom.strength = 1.3 - u * 0.6;
    } else if (te >= 1.2) { ring.material.opacity = 0; flash.material.opacity = 0; }

    // ---- globe transform (rotation + mouse tilt + scroll)
    globe.rotation.y += dt * 0.12;
    const targetTiltX = mouseSmooth.y * 0.25, targetTiltY = mouseSmooth.x * 0.35;
    globe.rotation.x += (targetTiltX - globe.rotation.x) * 0.05;
    const extraY = targetTiltY;
    const wide = camera.aspect > 1.1;
    const side = easeInOutCubic(clamp((t - (T_ASSEMBLE + T.assemble * 0.85)) / 1.4));
    globe.position.x = 0;
    globe.position.y = scrollP * 1.6;
    const gs = (1 - scrollP * 0.15) * (1 + side * ((wide ? 1.48 : 1.38) - 1));
    pMat.uniforms.uNear.value = -camera.position.z + R * gs; pMat.uniforms.uFar.value = -camera.position.z - R * gs;
    globe.scale.setScalar(gs);
    globe.updateMatrixWorld(true);
    gm.copy(globe.matrixWorld);
    const rotExtra = new THREE.Matrix4().makeRotationY(extraY);
    gm.multiply(rotExtra);
    halo.position.copy(globe.position); halo.scale.setScalar(R * 4.2 * gs);

    // cursor hit on globe
    hasHit = false;
    if (mouseActive && t > T_ASSEMBLE + 1.0) {
      ray.setFromCamera(mouseSmooth, camera);
      hitSphere.center.copy(globe.position); hitSphere.radius = R * gs * 1.02;
      hasHit = !!ray.ray.intersectSphere(hitSphere, hitPoint);
    }

    // ---- particles
    if (exploded) {
      const drag = Math.exp(-dt * 3.2);
      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        const ta = t - T_ASSEMBLE - delay[i];
        // world target
        wv.set(target[i3], target[i3 + 1], target[i3 + 2]).applyMatrix4(gm);
        if (ta <= 0 && !reducedMotion) {
          // free flight after explosion
          vel[i3] *= drag; vel[i3 + 1] *= drag; vel[i3 + 2] *= drag;
          pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
          from[i3] = pos[i3]; from[i3 + 1] = pos[i3 + 1]; from[i3 + 2] = pos[i3 + 2];
        } else {
          const u = reducedMotion ? 1 : clamp(ta / T.assemble);
          const e = easeInOutCubic(u);
          // cursor push
          let pushTarget = 0;
          if (hasHit) {
            const dx = wv.x - hitPoint.x, dy = wv.y - hitPoint.y, dz = wv.z - hitPoint.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < 1.1) pushTarget = (1 - d / 1.1) * 0.55;
          }
          push[i] += (pushTarget - push[i]) * 0.12;
          nrm.copy(wv).sub(globe.position).normalize();
          const px = wv.x + nrm.x * push[i], py = wv.y + nrm.y * push[i], pz = wv.z + nrm.z * push[i];
          if (u < 1) {
            // curve in with a slight swirl
            const sw = Math.sin(e * Math.PI) * 0.6;
            pos[i3] = from[i3] + (px - from[i3]) * e + sw * (-(from[i3 + 2]) * 0.05);
            pos[i3 + 1] = from[i3 + 1] + (py - from[i3 + 1]) * e;
            pos[i3 + 2] = from[i3 + 2] + (pz - from[i3 + 2]) * e + sw * (from[i3] * 0.05);
          } else { pos[i3] = px; pos[i3 + 1] = py; pos[i3 + 2] = pz; }
          // colour blend
          const ce = reducedMotion ? 1 : e;
          col[i3] = startCol[i3] + (endCol[i3] - startCol[i3]) * ce;
          col[i3 + 1] = startCol[i3 + 1] + (endCol[i3 + 1] - startCol[i3 + 1]) * ce;
          col[i3 + 2] = startCol[i3 + 2] + (endCol[i3 + 2] - startCol[i3 + 2]) * ce;
          const glowBoost = push[i] * 1.6;
          alpha[i] = (kind[i] ? 0.95 : 0.13) * (1 - scrollP * 0.6) + glowBoost;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.attributes.alpha.needsUpdate = true;
    }

    // ---- reveal atmosphere, halo and arcs
    const rv = clamp((t - (T_ASSEMBLE + T.assemble * 0.7)) / 1.2);
    atmo.material.uniforms.uOpacity.value = rv * 0.38 * (1 - scrollP * 0.7);
    halo.material.opacity = rv * 0.05 * (1 - scrollP);
    arcs.update(t, rv * (1 - scrollP));
    if (!readyFired && t > T_ASSEMBLE + 0.6) { readyFired = true; onReady && onReady(); }
    if (exploded && t > T_DONE) bloom.strength += (0.42 - bloom.strength) * 0.05;

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reducedMotion && onReady) { readyFired = true; onReady(); }

  return {
    setScroll(p) { scrollP = clamp(p); },
    replay() { t = 0; exploded = false; readyFired = false; diamond.visible = true; core.material.opacity = 0.35; core.scale.setScalar(1.8); alpha.fill(0); pGeo.attributes.alpha.needsUpdate = true; },
    pause() { running = false; }, resume() { if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); } },
  };
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

function buildArcs(globe, target, nLand, R, glowTex) {
  const COUNT = 7; const arcs = [];
  const pick = () => { const i = (Math.random() * nLand) | 0; return new THREE.Vector3(target[i * 3], target[i * 3 + 1], target[i * 3 + 2]); };
  for (let k = 0; k < COUNT; k++) {
    let a = pick(), b = pick(); let guard = 0;
    while (a.angleTo(b) < 0.7 && guard++ < 30) b = pick();
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.25 + a.angleTo(b) * 0.18));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(80);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const prog = new Float32Array(pts.length); for (let i = 0; i < pts.length; i++) prog[i] = i / (pts.length - 1);
    geo.setAttribute('prog', new THREE.BufferAttribute(prog, 1));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHead: { value: 0 }, uOp: { value: 0 } },
      vertexShader: `attribute float prog; varying float vP; void main(){ vP = prog; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uHead; uniform float uOp; varying float vP; void main(){ float tail = smoothstep(uHead-0.35, uHead, vP) * step(vP, uHead); float base = 0.12; gl_FragColor = vec4(0.55,0.88,1.0, (base + tail*0.9)*uOp); }` });
    const line = new THREE.Line(geo, mat); globe.add(line);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcff6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    head.scale.setScalar(0.12); globe.add(head);
    arcs.push({ curve, mat, head, speed: 0.22 + Math.random() * 0.18, offset: Math.random() });
  }
  return {
    update(t, op) {
      for (const a of arcs) {
        const h = ((t * a.speed + a.offset) % 1.3);
        a.mat.uniforms.uHead.value = h; a.mat.uniforms.uOp.value = op;
        const hp = Math.min(1, h); a.curve.getPoint(hp, a.head.position);
        a.head.material.opacity = op * (h <= 1 ? 1 : 0);
      }
    },
  };
}
