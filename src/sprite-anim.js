// Animación 2D con los dibujos de la hoja de personaje (animación 2D clásica por poses).
//   test : prueba de movimientos para validar el personaje.
//   show : secuencia de 5 plátanos. Video (pantalla negra) -> todos ponen la boca en U invertida
//          -> uno llama con la mano a otro -> llega andando, se sienta -> siguiente video...
import { drawSprite, loadSprites } from './sprite-banana.js';

export const W = 1080, H = 1920, FPS = 30;
export { loadSprites };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  lin: (x) => x,
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  out: (x) => 1 - (1 - x) ** 3,
  back: (x) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
};
function track(keys) {
  keys = keys.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (!keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i]; return lerp(v0, v1, EASE[e || 'io']((t - t0) / (t1 - t0))); }
    }
    return keys[keys.length - 1][1];
  };
}
const settle = (t, t0, amp, f = 2.4, d = 6) => (t < t0 ? 0 : amp * Math.exp(-d * (t - t0)) * Math.sin(2 * Math.PI * f * (t - t0)));
const pulse = (t, t0, d) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x); };

// brazo del gesto de llamar (en coordenadas del dibujo "call"): se gira desde el hombro
const CALL_ARM = { clip: [113, 92, 95, 65], pivot: [112, 140] };
const WALK = ['walk1', 'walk2', 'walk3', 'walk2'];
const HOLD = 0.165; // s por dibujo al andar (5 fotogramas)
const STEP = 0.29; // avance (unidades del cuerpo) por dibujo

// ---------------------------------------------------------------- personaje
function makeChar(pal, x, wz) {
  return { pal, x0: x, wz, segs: [], frown: [], lookX: [], lookY: [], blinks: [], bumps: [] };
}
const seg = (c, s) => { c.segs.push(s); return s; };
// secuencia de dibujos: [[pose, flip, duración], ...]
function seq(c, t0, frames, bump = 0.05) {
  let t = t0;
  for (const [pose, flip, d, extra] of frames) { seg(c, { t0: t, t1: t + d, kind: 'pose', pose, flip, ...(extra || {}) }); if (bump) c.bumps.push({ t, sx: -bump }); t += d; }
  return t;
}
function walkSeg(c, t0, t1, x1, dir) {
  // velocidad constante con arranque y frenada suaves; los dibujos cambian cada HOLD
  const v = STEP / HOLD;
  const amp = (t) => clamp((t - t0) / 0.2) * clamp((t1 - t) / 0.25);
  const N = 300, dt = (t1 - t0) / N, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + v * amp(t0 + (i - 0.5) * dt) * dt);
  const D = cum[N];
  const s = seg(c, { t0, t1, kind: 'walk', dir, x0: x1 - dir * D, x1, dist: (t) => { const f = clamp((t - t0) / dt, 0, N), i = Math.floor(f); return lerp(cum[i], cum[Math.min(N, i + 1)], f - i); } });
  return s;
}

function charAt(c, t) {
  // posición: la última caminata que ya empezó
  let x = c.x0, cur = null;
  for (const s of c.segs) {
    if (s.kind === 'walk' && t >= s.t0) x = t < s.t1 ? s.x0 + s.dir * s.dist(t) : s.x1;
    else if (s.kind === 'walk' && t < s.t0 && cur === null && x === c.x0) x = s.x0;
    if (t >= s.t0) cur = s;
  }
  if (!cur) return null;
  if (cur.kind === 'hide') return null;
  const st = { x, wz: c.wz, pal: c.pal, sx: 1, sy: 1, rot: 0, lift: 0 };
  if (cur.kind === 'walk') {
    const ph = t < cur.t1 ? Math.floor((t - cur.t0) / HOLD) : 0;
    st.pose = t < cur.t1 - 0.12 ? WALK[ph % 4] : 'q34';
    st.flip = cur.dir < 0;
    if (st.pose === 'walk2') st.lift = 0.012; // al pasar la pierna, sube un poco
  } else {
    st.pose = cur.pose; st.flip = !!cur.flip;
    if (cur.call) {
      // brazo: sale con impulso y luego hace "ven" con la mano
      const k = clamp((t - cur.t0) / 0.3);
      const out = cur.t1 - t < 0.25 ? clamp((cur.t1 - t) / 0.25) : 1;
      const beck = t > cur.t0 + 0.3 ? 0.16 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.8 * (t - cur.t0 - 0.3))) : 0;
      st.part = { ...CALL_ARM, rot: (1 - EASE.back(k)) * 0.55 - beck + (1 - out) * 0.5 };
    }
    if (cur.sy) st.sy = cur.sy;
    if (cur.rot) st.rot = cur.rot;
  }
  // aplastar/estirar en cada cambio de dibujo (se asienta solo)
  for (const b of c.bumps) { st.sx += settle(t, b.t, b.sx || 0, 2.6, 9); st.sy += settle(t, b.t, b.sy || 0, 2.2, 7); }
  // respiración
  st.sy += 0.008 * Math.sin(t * 2.3 + c.x0 * 3);
  let blink = 0;
  for (const b of c.blinks) blink = Math.max(blink, pulse(t, b, 0.18));
  st.face = { frown: track(c.frown)(t), lookX: track(c.lookX)(t), lookY: track(c.lookY)(t), blink };
  return st;
}

// ---------------------------------------------------------------- secuencia de 5 plátanos
const PALS = ['yellow', 'green', 'pink', 'blue', 'purple'];
const SLOTS = [[-0.55, 0], [0.55, 0], [-1.2, 0.7], [1.2, 0.7], [0, 1.15]];
const ENTRY = [-1, 1, -1, 1, -1]; // por dónde entra cada uno (+1 derecha)
const FACE_RIGHT = [true, false, true, false, true]; // hacia dónde mira sentado (hacia el móvil)
const FRAMES = [[-0.3, 0.55, 690], [0, 0.58, 520], [-0.15, 0.68, 440], [0, 0.7, 410], [0, 0.76, 400]];

export function buildShow({ videoLen = 2.5, count = 5 } = {}) {
  const sh = { chars: [], videos: [], cues: [], cam: { x: [], y: [], z: [] } };
  const cams = (t, F) => ['x', 'y', 'z'].forEach((k, j) => sh.cam[k].push([t, F[j], 'io']));
  cams(0, FRAMES[0]);
  // --- entra el amarillo andando, mira a cámara, se gira hacia el móvil y se sienta
  const y = makeChar('yellow', SLOTS[0][0], 0);
  sh.chars.push(y);
  walkSeg(y, 0.1, 2.3, SLOTS[0][0], 1);
  let t = seq(y, 2.3, [['q34', false, 0.25], ['front', false, 0.9], ['q34', false, 0.3], ['slump', false, 0.2, { sy: 0.97 }]]);
  y.blinks.push(1.5, 2.85);
  y.lookY.push([0, 0]);
  sitDown(sh, y, t, false);
  t += 0.4;
  y.lookY.push([t + 0.2, 0], [t + 0.5, 0.8]); // mira el móvil (abajo)
  for (let s = 0.3; s < 2.3; s += 2 * HOLD) sh.cues.push({ t: s, type: 'step', gain: 0.4 });
  t += 0.9;

  for (let v = 0; v < count; v++) {
    sh.videos.push([t, t + videoLen, v + 1]);
    sh.cues.push({ t: t - 0.05, type: 'whoosh', gain: 0.6 });
    t += videoLen;
    const Te = t;
    const seated = sh.chars.slice();
    // todos ponen la boca en U invertida a la vez
    for (const c of seated) {
      c.frown.push([Te + 0.03, 0], [Te + 0.2, 1, 'out']);
      c.lookY.push([Te, 0.8], [Te + 0.25, 0.1]);
      c.bumps.push({ t: Te + 0.03, sy: -0.05 });
      c.blinks.push(Te + 0.55);
    }
    sh.cues.push({ t: Te + 0.08, type: 'womp', gain: 0.85 });
    if (v === count - 1) { for (const c of seated) c.blinks.push(Te + 1.9); t = Te + 2.7; break; }
    for (const c of seated) c.frown.push([Te + 1.25, 1], [Te + 1.5, 0]);
    // --- el que está más cerca de la entrada llama con la mano
    const k = v + 1, side = ENTRY[k];
    const caller = seated.reduce((b, c) => (side * c.x0 > side * b.x0 ? c : b), seated[0]);
    const ci = sh.chars.indexOf(caller);
    const callFlip = side < 0; // el dibujo "call" estira el brazo hacia donde mira
    const sitFlip = !FACE_RIGHT[ci];
    let tc = Te + 1.4;
    if (callFlip !== sitFlip) { tc = seq(caller, tc, [['sit', callFlip, 0.18]], 0.12); }
    seg(caller, { t0: tc, t1: tc + 2.1, kind: 'pose', pose: 'call', flip: callFlip, call: true });
    caller.bumps.push({ t: tc, sx: 0.05 });
    caller.lookY.push([Te + 1.3, 0.1], [Te + 1.5, -0.2], [tc + 2.1, -0.2], [tc + 2.4, 0.1]);
    let tb = tc + 2.1;
    if (callFlip !== sitFlip) tb = seq(caller, tb, [['sit', sitFlip, 0.1]], 0.1);
    seg(caller, { t0: tb, t1: tb + 99, kind: 'pose', pose: 'sit', flip: sitFlip });
    // los demás miran hacia el que llega
    for (const c of seated) {
      if (c === caller) continue;
      const lx = side; // mira hacia la entrada
      c.lookX.push([Te + 1.6, 0], [Te + 1.9, lx], [Te + 4.2, lx], [Te + 4.5, 0]);
      c.blinks.push(Te + 2.8);
    }
    // --- llega el nuevo andando y se sienta
    const nc = makeChar(PALS[k], SLOTS[k][0], SLOTS[k][1]);
    sh.chars.push(nc);
    seg(nc, { t0: 0, t1: Te + 1.9, kind: 'hide' });
    const dir = -side;
    walkSeg(nc, Te + 1.9, Te + 4.0, SLOTS[k][0], dir);
    const ff = !FACE_RIGHT[k];
    const ts = seq(nc, Te + 4.0, ff === (dir < 0) ? [['q34', ff, 0.2], ['slump', ff, 0.2, { sy: 0.97 }]] : [['q34', dir < 0, 0.15], ['front', false, 0.12], ['q34', ff, 0.15], ['slump', ff, 0.2, { sy: 0.97 }]]);
    sitDown(sh, nc, ts, ff);
    nc.blinks.push(Te + 4.2);
    nc.lookY.push([0, 0], [ts + 0.6, 0], [ts + 0.9, 0.8]);
    for (let s = Te + 2.05; s < Te + 4.0; s += 2 * HOLD) sh.cues.push({ t: s, type: 'step', gain: 0.35 });
    cams(Te + 1.9, FRAMES[k - 1]); cams(Te + 4.0, FRAMES[k]);
    // todos miran el móvil y empieza el siguiente video
    for (const c of seated) c.lookY.push([Te + 4.7, c === caller ? 0.1 : 0], [Te + 5.0, 0.8]);
    t = Math.max(Te + 5.4, ts + 1.3);
  }
  sh.duration = t;
  sh.camT = { x: track(sh.cam.x), y: track(sh.cam.y), z: track(sh.cam.z) };
  return sh;
}
function sitDown(sh, c, t0, flip) {
  // de doblado a sentado: cae, se aplasta un poco y se asienta
  seg(c, { t0, t1: t0 + 99, kind: 'pose', pose: 'sit', flip });
  c.bumps.push({ t: t0, sy: -0.09, sx: 0.06 });
  sh.cues.push({ t: t0 + 0.02, type: 'thud', gain: 0.5 });
}

// ---------------------------------------------------------------- prueba de movimientos
export function buildTest() {
  const sh = { chars: [], videos: [], cues: [], labels: [], single: true };
  const c = makeChar('yellow', 0, 0);
  sh.chars.push(c);
  const L = (a, b, s) => sh.labels.push([a, b, s]);
  // 1) giro completo
  let t = seq(c, 0, [['front', false, 0.9], ['q34', false, 0.45], ['side', false, 0.45], ['back', false, 0.6], ['side', true, 0.45], ['q34', true, 0.45], ['front', false, 0.7]], 0.06);
  L(0, t, 'Giro: frente · 3/4 · perfil · espalda');
  // 2) cara
  const f0 = t;
  seg(c, { t0: t, t1: t + 2.6, kind: 'pose', pose: 'front' });
  c.blinks.push(f0 + 0.3, f0 + 2.2);
  c.lookX.push([f0 + 0.5, 0], [f0 + 0.7, -1], [f0 + 1.0, -1], [f0 + 1.2, 1], [f0 + 1.5, 1], [f0 + 1.7, 0]);
  c.frown.push([f0 + 1.7, 0], [f0 + 1.9, 1, 'out'], [f0 + 2.4, 1], [f0 + 2.6, 0]);
  c.bumps.push({ t: f0 + 1.7, sy: -0.04 });
  t += 2.6;
  L(f0, t, 'Mirada · parpadeo · boca en U invertida');
  // 3) andar
  const w0 = t;
  t = seq(c, t, [['q34', false, 0.25]]);
  walkSeg(c, t, t + 3.3, 0, 1);
  for (let s = t + 0.15; s < t + 3.3; s += 2 * HOLD) sh.cues.push({ t: s, type: 'step', gain: 0.4 });
  t += 3.3;
  L(w0, t, 'Caminar');
  // 4) sentarse
  const s0 = t;
  t = seq(c, t, [['q34', false, 0.35], ['slump', false, 0.22, { sy: 0.97 }]]);
  sitDown(sh, c, t, false);
  t += 0.8;
  L(s0, t, 'Sentarse');
  // 5) mirar el móvil y llamar con la mano
  const m0 = t;
  c.lookY.push([0, 0], [m0, 0], [m0 + 0.3, 0.8], [m0 + 1.0, 0.8], [m0 + 1.2, 0]);
  seg(c, { t0: m0 + 1.2, t1: m0 + 3.4, kind: 'pose', pose: 'call', flip: false, call: true });
  c.bumps.push({ t: m0 + 1.2, sx: 0.05 });
  seg(c, { t0: m0 + 3.4, t1: m0 + 3.6, kind: 'pose', pose: 'sit' });
  t = m0 + 3.6;
  L(m0, t, 'Mirar el móvil · llamar con la mano');
  // 6) abrazar las rodillas con la U invertida
  const h0 = t;
  seg(c, { t0: h0, t1: h0 + 2.2, kind: 'pose', pose: 'hug' });
  c.bumps.push({ t: h0, sy: -0.05 });
  c.frown.push([h0 + 0.2, 0], [h0 + 0.4, 1, 'out'], [h0 + 1.9, 1], [h0 + 2.1, 0]);
  c.blinks.push(h0 + 1.2);
  t = h0 + 2.2;
  L(h0, t, 'Abrazar las rodillas');
  // 7) levantarse cabizbajo
  const u0 = t;
  t = seq(c, t, [['sit', false, 0.2], ['slump', false, 1.6], ['q34', false, 0.4], ['front', false, 1.0]], 0.07);
  c.frown.push([u0 + 0.3, 0], [u0 + 0.5, 1, 'out'], [u0 + 1.8, 1], [u0 + 2.0, 0]);
  c.blinks.push(u0 + 1.2, t - 0.5);
  L(u0, t, 'Levantarse · cabizbajo');
  sh.duration = t;
  return sh;
}

// ---------------------------------------------------------------- dibujo
const BG = '#e0d6d3';
const persp = (wz) => 1 / (1 + 0.34 * wz);
const PX = 230; // px del dibujo que mide el cuerpo (para pasar de unidades a escala del dibujo)

function drawVideo(ctx, n) {
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 170px Rubik, Arial, sans-serif'; ctx.fillText(`VIDEO ${n}`, W / 2, H / 2 - 20);
  ctx.globalAlpha = 0.45; ctx.font = '600 38px Rubik, Arial, sans-serif'; ctx.fillText('aquí va el video viral', W / 2, H / 2 + 110); ctx.globalAlpha = 1;
}

export function drawFrame(ctx, sh, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [a, b, n] of sh.videos) if (t >= a && t < b) { drawVideo(ctx, n); return; }
  const cam = sh.single ? { x: (charAt(sh.chars[0], t) || { x: 0 }).x, y: 0.5, z: 780 } : { x: sh.camT.x(t), y: sh.camT.y(t), z: sh.camT.z(t) };
  const toScreen = (wx, wz) => { const f = persp(wz); return { x: W / 2 + (wx - cam.x) * cam.z * f, y: H / 2 - (wz * 0.55 - cam.y) * cam.z, S: cam.z * f }; };
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const g0 = toScreen(0, 0);
  const g = ctx.createLinearGradient(0, g0.y - cam.z, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(120,95,90,0.05)'); g.addColorStop(1, 'rgba(120,95,90,0.12)');
  ctx.fillStyle = g; ctx.fillRect(0, g0.y - cam.z, W, H);
  if (sh.single) {
    ctx.fillStyle = 'rgba(120,95,90,0.12)';
    for (let k = Math.floor(cam.x - 2); k <= cam.x + 2; k += 0.5) { const p = toScreen(k, -0.3); ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const items = [];
  for (const c of sh.chars) {
    const st = charAt(c, t);
    if (!st) continue;
    items.push({ wz: st.wz, draw: () => {
      const p = toScreen(st.x, st.wz);
      // sombra
      ctx.fillStyle = 'rgba(90,60,50,.15)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.S * 0.34, p.S * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      drawSprite(ctx, { pose: st.pose, pal: st.pal, x: p.x, y: p.y - st.lift * p.S, s: p.S / PX, flip: st.flip, sx: st.sx, sy: st.sy, rot: st.rot, face: st.face, part: st.part });
    } });
  }
  if (!sh.single) items.push({ wz: -0.55, draw: () => { const p = toScreen(0, -0.55); drawSprite(ctx, { pose: 'phone', x: p.x, y: p.y, s: (p.S / PX) * 0.85, flip: true }); } });
  items.sort((a, b) => b.wz - a.wz);
  for (const it of items) it.draw();
  if (sh.labels) for (const [a, b, text] of sh.labels) {
    if (t < a || t >= b) continue;
    ctx.globalAlpha = clamp((t - a) / 0.25) * clamp((b - t) / 0.25);
    ctx.fillStyle = '#2a2220'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '700 46px Rubik, Arial, sans-serif'; ctx.fillText(text, W / 2, 150);
    ctx.globalAlpha = 1;
  }
}
