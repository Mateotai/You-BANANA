// Animaciones del plátano 2D (diseño de la hoja de personaje).
//   test : prueba de movimientos para validar el personaje.
//   show : secuencia completa. Video (pantalla negra) -> todos ponen la boca en U invertida ->
//          uno llama con la mano a otro plátano -> llega, se sienta -> siguiente video ... hasta 5.
// Todo es una función continua del tiempo (sin saltos), a 30 fps.
import { drawToon, PALETTES, STRIDE } from './toon.js';

export const W = 1080, H = 1920, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  lin: (x) => x,
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  out: (x) => 1 - (1 - x) ** 3,
  in: (x) => x * x * x,
  back: (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
};
// pista de claves [t, valor, easing] (el easing es el del tramo que llega a esa clave)
function track(keys) {
  keys = keys.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
        return lerp(v0, v1, (EASE[e || 'io'])((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  };
}
// oscilación amortiguada (para asentarse después de un movimiento)
const settle = (t, t0, amp, freq = 2.2, decay = 5) => (t < t0 ? 0 : amp * Math.exp(-decay * (t - t0)) * Math.sin(2 * Math.PI * freq * (t - t0)));
const pulse = (t, t0, d) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x); };

// ---------------------------------------------------------------- caminar sin que resbalen los pies
const CYCLE = 0.68; // s por ciclo de pasos
function walkTrack(t0, t1, x1, dir, phiWalk) {
  // amplitud: arranca y frena suave
  const amp = (t) => clamp((t - t0) / 0.28) * clamp((t1 - t) / 0.32);
  const v = (4 * STRIDE * Math.abs(Math.sin(phiWalk))) / CYCLE; // unidades/s con amplitud 1
  const N = 400, dt = (t1 - t0) / N, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + v * amp(t0 + (i - 0.5) * dt) * dt);
  const D = cum[N], x0 = x1 - dir * D;
  const dist = (t) => { if (t <= t0) return 0; if (t >= t1) return D; const f = (t - t0) / dt, i = Math.floor(f); return lerp(cum[i], cum[Math.min(N, i + 1)], f - i); };
  return {
    x: (t) => x0 + dir * dist(t),
    phase: (t) => (2 * Math.PI * (clamp(t, t0, t1) - t0)) / CYCLE, // ritmo constante; la zancada crece con la amplitud
    amp: (t) => (t > t0 && t < t1 ? amp(t) : 0),
    x0, D,
  };
}

// ---------------------------------------------------------------- personaje animado
function makeChar(pal, slot) {
  return { pal, slot, phi: [], sit: [], walk: null, look: [], lookY: [], frown: [], slump: [], call: [], hug: [], blinks: [], beck: [], appear: 0, extra: [] };
}
function charState(c, t, i) {
  const st = { pal: c.pal };
  const tr = (k, d) => (c[k].length ? track(c[k])(t) : d);
  st.phi = tr('phi', 0);
  let x = c.slot[0], wz = c.slot[1], pose = {};
  if (c.walk && t < c.walk.t1 + 0.01) {
    x = c.walk.tr.x(t);
    pose.walk = c.walk.tr.phase(t);
    pose.amp = c.walk.tr.amp(t);
  }
  st.visible = t >= c.appear;
  st.x = x; st.wz = wz;
  pose.sit = tr('sit', 0);
  pose.slump = tr('slump', 0);
  pose.hug = tr('hug', 0);
  pose.call = tr('call', 0);
  pose.callSide = c.callSide ? c.callSide(t) : 1;
  pose.beck = (t - (c.beckT0 || 0)) * 2 * Math.PI * 1.7;
  st.pose = pose;
  let blink = 0;
  for (const b of c.blinks) blink = Math.max(blink, pulse(t, b, 0.17));
  st.face = { lookX: tr('look', 0), lookY: tr('lookY', 0), frown: tr('frown', 0), blink };
  // respiración + inclinaciones
  let tilt = 0.08 * (pose.amp || 0) + 0.16 * pose.slump;
  let sq = 0.01 * Math.sin((2 * Math.PI * t) / 2.7 + i * 1.3);
  for (const e of c.extra) { tilt += settle(t, e.t, e.tilt || 0, e.f || 2, e.d || 5); sq += settle(t, e.t, e.sq || 0, e.f || 2.4, e.d || 6); }
  // anticipación al sentarse: agacharse un poco antes, y aplastarse al llegar al suelo
  st.tilt = tilt; st.sq = sq;
  return st;
}
function sitDown(c, t0, dur = 0.75) {
  c.sit.push([t0, 0], [t0 + dur, 1, 'io']);
  c.extra.push({ t: t0 - 0.12, sq: -0.035, f: 1.6, d: 9 }); // se agacha
  c.extra.push({ t: t0 + dur * 0.92, sq: -0.07, f: 2.6, d: 6, tilt: -0.05 }); // aterriza
}
function standUp(c, t0, dur = 0.7) {
  c.sit.push([t0, 1], [t0 + dur, 0, 'io']);
  c.extra.push({ t: t0, sq: -0.04, f: 1.5, d: 8, tilt: 0.06 });
  c.extra.push({ t: t0 + dur, sq: 0.04, f: 2.2, d: 6 });
}
function turn(c, t0, from, to, dur = 0.38) {
  c.phi.push([t0, from], [t0 + dur, to, 'io']);
  c.extra.push({ t: t0, sq: -0.02, f: 1.4, d: 7 });
}
function walk(c, t0, t1, x1, dir, phiWalk) {
  c.walk = { t0, t1, tr: walkTrack(t0, t1, x1, dir, phiWalk) };
  c.slot = [x1, c.slot[1]];
  c.phi.push([t0 - 0.01, phiWalk, 'lin'], [t1, phiWalk, 'lin']);
  c.extra.push({ t: t1 - 0.05, tilt: 0.09, f: 1.5, d: 5 }); // frena: se balancea hacia delante y vuelve
}

// ---------------------------------------------------------------- escena: secuencia de 5 plátanos
const SLOTS = [[-0.6, 0], [0.6, 0], [-0.92, 0.72], [0.92, 0.72], [0, 1.15]];
const ENTRY = [-1, 1, -1, 1, -1]; // lado por el que entra cada uno (+1 derecha)
const PALS = [PALETTES.yellow, PALETTES.green, PALETTES.pink, PALETTES.blue, PALETTES.purple];
const PHONE = [0, -0.55];
const watchPhi = ([x, z]) => Math.atan2(PHONE[0] - x, z - PHONE[1]);
// encuadre según cuántos hay (centro x, centro "altura", zoom)
const FRAMES = [[-0.3, 0.5, 700], [0, 0.55, 500], [-0.12, 0.66, 450], [0, 0.7, 430], [0, 0.76, 420]];

export function buildShow({ videoLen = 2.5, count = 5 } = {}) {
  const sh = { chars: [], videos: [], cues: [], cam: { x: [], y: [], z: [] } };
  const c0 = makeChar(PALS[0], SLOTS[0]);
  sh.chars.push(c0);
  // --- entrada del amarillo
  const wp0 = watchPhi(SLOTS[0]);
  walk(c0, 0.15, 2.25, SLOTS[0][0], 1, 1.05);
  turn(c0, 2.4, 1.05, 0, 0.42);
  c0.blinks.push(1.2, 2.95);
  turn(c0, 3.2, 0, wp0, 0.38);
  sitDown(c0, 3.62, 0.75);
  c0.lookY.push([4.5, 0], [4.8, -0.7]); c0.look.push([0, 0]);
  sh.cues.push({ t: 4.36, type: 'thud', gain: 0.55 });
  for (let s = c0.walk.t0 + 0.2; s < c0.walk.t1; s += CYCLE / 2) sh.cues.push({ t: s, type: 'step', gain: 0.45 });
  let t = 5.1;
  for (const k of ['x', 'y', 'z']) sh.cam[k].push([0, FRAMES[0][['x', 'y', 'z'].indexOf(k)]]);

  for (let v = 0; v < count; v++) {
    // --- video v
    sh.videos.push([t, t + videoLen, v + 1]);
    sh.cues.push({ t: t - 0.05, type: 'whoosh', gain: 0.6 });
    t += videoLen;
    const Te = t;
    const seated = sh.chars.slice();
    // --- todos ponen la boca en U invertida a la vez (y se desinflan un poco)
    for (const c of seated) {
      c.frown.push([Te + 0.02, 0], [Te + 0.22, 1, 'out']);
      c.slump.push([Te, 0], [Te + 0.4, 0.55, 'out']);
      c.lookY.push([Te, -0.7], [Te + 0.3, -0.2]);
      c.blinks.push(Te + 0.55);
    }
    sh.cues.push({ t: Te + 0.08, type: 'womp', gain: 0.85 });
    if (v === count - 1) {
      // final: se quedan así
      for (const c of seated) c.blinks.push(Te + 1.9);
      t = Te + 2.6;
      break;
    }
    for (const c of seated) { c.frown.push([Te + 1.2, 1], [Te + 1.5, 0]); c.slump.push([Te + 1.2, 0.55], [Te + 1.6, 0]); }
    // --- llama a otro
    const k = v + 1, slot = SLOTS[k], entrySide = ENTRY[k], dir = -entrySide; // dir: hacia dónde anda el nuevo
    const caller = seated.reduce((best, c) => (entrySide * c.slot[0] > entrySide * best.slot[0] ? c : best), seated[0]);
    const cphi = watchPhi(caller.slot), callPhi = entrySide * 1.0;
    turn(caller, Te + 1.35, cphi, callPhi, 0.4);
    caller.call.push([Te + 1.6, 0], [Te + 1.95, 1, 'back'], [Te + 3.45, 1], [Te + 3.85, 0, 'io']);
    caller.beckT0 = Te + 1.95; // el gesto de "ven" con la mano
    const prevSide = caller.callSide;
    caller.callSide = (tt) => (tt >= Te + 1.3 && tt < Te + 4.2 ? entrySide : prevSide ? prevSide(tt) : 1);
    turn(caller, Te + 3.7, callPhi, cphi, 0.42);
    caller.lookY.push([Te + 1.35, -0.2], [Te + 1.7, 0.1], [Te + 3.7, 0.1], [Te + 4.1, -0.1]);
    // los demás miran hacia el que llega
    for (const c of seated) {
      if (c === caller) continue;
      const wp = watchPhi(c.slot);
      c.phi.push([Te + 1.7, wp], [Te + 2.15, lerp(wp, entrySide * 1.0, 0.45)], [Te + 3.9, lerp(wp, entrySide * 1.0, 0.45)], [Te + 4.3, wp]);
      c.look.push([Te + 1.7, 0], [Te + 2.1, entrySide * 0.6], [Te + 3.9, entrySide * 0.6], [Te + 4.3, 0]);
      c.blinks.push(Te + 2.6);
    }
    // --- el nuevo llega andando, se gira hacia el móvil y se sienta
    const nc = makeChar(PALS[k], slot);
    nc.appear = Te + 1.7;
    const wphi = dir * 1.05;
    walk(nc, Te + 1.75, Te + 3.75, slot[0], dir, wphi);
    turn(nc, Te + 3.85, wphi, watchPhi(slot), 0.36);
    sitDown(nc, Te + 4.2, 0.72);
    nc.blinks.push(Te + 4.05);
    nc.lookY.push([Te + 1.7, 0], [Te + 5.0, 0], [Te + 5.3, -0.7]);
    sh.chars.push(nc);
    for (let s = nc.walk.t0 + 0.2; s < nc.walk.t1; s += CYCLE / 2) sh.cues.push({ t: s, type: 'step', gain: 0.4 });
    sh.cues.push({ t: Te + 4.92, type: 'thud', gain: 0.5 });
    // la cámara se abre para que quepan todos
    const F0 = FRAMES[k - 1], F1 = FRAMES[k];
    ['x', 'y', 'z'].forEach((key, j) => sh.cam[key].push([Te + 1.75, F0[j]], [Te + 3.9, F1[j], 'io']));
    // --- todos miran el móvil -> siguiente video
    for (const c of seated) c.lookY.push([Te + 5.0, c === caller ? -0.1 : 0], [Te + 5.3, -0.7]);
    t = Te + 5.6;
  }
  sh.duration = t;
  sh.camT = { x: track(sh.cam.x), y: track(sh.cam.y), z: track(sh.cam.z) };
  return sh;
}

// ---------------------------------------------------------------- escena: prueba de movimientos
export function buildTest() {
  const sh = { chars: [], videos: [], cues: [], labels: [] };
  const c = makeChar(PALETTES.yellow, [0, 0]);
  sh.chars.push(c);
  const L = (t0, t1, text) => sh.labels.push([t0, t1, text]);
  // 1) giro completo
  c.phi.push([0.4, 0], [3.4, 2 * Math.PI, 'io']);
  L(0, 3.6, 'Giro: frente · 3/4 · perfil · espalda');
  // 2) parpadeo y U invertida
  c.blinks.push(3.8, 5.6);
  c.frown.push([4.3, 0], [4.55, 1, 'out'], [5.3, 1], [5.6, 0]);
  c.slump.push([4.3, 0], [4.7, 0.5, 'out'], [5.3, 0.5], [5.7, 0]);
  L(3.6, 5.9, 'Parpadeo · boca en U invertida');
  // 3) andar (la cámara le sigue)
  turn(c, 5.9, 0, 1.05, 0.35);
  c.phi.push([6.3, 1.05]);
  const wk = walkTrack(6.3, 9.0, 0, 1, 1.05);
  c.walk = { t0: 6.3, t1: 9.0, tr: wk };
  c.slot = [0, 0];
  c.extra.push({ t: 8.95, tilt: 0.09, f: 1.5, d: 5 });
  for (let s = 6.5; s < 9.0; s += CYCLE / 2) sh.cues.push({ t: s, type: 'step', gain: 0.45 });
  L(5.9, 9.2, 'Caminar');
  // 4) se gira, se sienta
  turn(c, 9.2, 1.05, 0.6, 0.45);
  sitDown(c, 9.75, 0.75);
  sh.cues.push({ t: 10.48, type: 'thud', gain: 0.55 });
  L(9.2, 10.8, 'Sentarse');
  // 5) mirar el móvil y llamar con la mano
  c.lookY.push([10.8, 0], [11.1, -0.7], [11.8, -0.7], [12.1, 0.1], [14.1, 0.1], [14.4, 0]);
  turn(c, 11.9, 0.6, 1.0, 0.35);
  c.call.push([12.1, 0], [12.45, 1, 'back'], [13.9, 1], [14.3, 0]);
  c.beckT0 = 12.45;
  c.callSide = () => 1;
  L(10.8, 14.4, 'Mirar el móvil · llamar con la mano');
  // 6) abrazar las rodillas con la U invertida
  turn(c, 14.3, 1.0, 0.5, 0.35);
  c.hug.push([14.5, 0], [14.95, 1, 'io'], [16.2, 1], [16.6, 0]);
  c.frown.push([14.6, 0], [14.8, 1, 'out'], [16.1, 1], [16.4, 0]);
  c.blinks.push(15.5);
  L(14.4, 16.6, 'Abrazar las rodillas');
  // 7) levantarse, cabizbajo y vuelta a cámara
  standUp(c, 16.7, 0.7);
  c.slump.push([17.6, 0], [18.0, 1, 'out'], [18.9, 1], [19.3, 0]);
  c.frown.push([17.6, 0], [17.85, 1, 'out'], [18.9, 1], [19.2, 0]);
  c.lookY.push([17.6, 0], [18.0, -0.6], [18.9, -0.6], [19.3, 0]);
  turn(c, 19.3, 0.5, 0, 0.4);
  c.blinks.push(19.9);
  L(16.6, 20.6, 'Levantarse · cabizbajo');
  sh.duration = 20.6;
  sh.single = true;
  return sh;
}

// ---------------------------------------------------------------- dibujo
const BG = '#e0d6d3';
function persp(wz) { return 1 / (1 + 0.34 * wz); }
function drawBackground(ctx, groundY0, S) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // suelo muy suave (la hoja es un fondo liso)
  const g = ctx.createLinearGradient(0, groundY0 - S * 1.0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(120,95,90,0.06)'); g.addColorStop(1, 'rgba(120,95,90,0.14)');
  ctx.fillStyle = g; ctx.fillRect(0, groundY0 - S * 1.0, W, H);
}
function drawPhone(ctx, x, y, S) {
  // móvil en un soporte, visto por detrás (como en la hoja)
  const k = S / 420; // ~0,36 del alto del plátano, como en la hoja
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(90,60,50,.16)'; ctx.beginPath(); ctx.ellipse(0, 2, 60, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 4.5; ctx.strokeStyle = '#0b0503';
  ctx.fillStyle = '#3a393c';
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-4, -58); ctx.lineTo(22, -58); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.rotate(0.1);
  const g = ctx.createLinearGradient(-36, 0, 40, 0); g.addColorStop(0, '#5a595d'); g.addColorStop(1, '#3d3c40');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-36, -152, 74, 140, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2c2b2e'; ctx.beginPath(); ctx.roundRect(-26, -142, 28, 34, 8); ctx.fill();
  ctx.fillStyle = '#111'; for (const [cx, cy] of [[-17, -132], [-8, -118]]) { ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawVideo(ctx, n) {
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 170px Rubik, Arial, sans-serif'; ctx.fillText(`VIDEO ${n}`, W / 2, H / 2 - 20);
  ctx.globalAlpha = 0.45; ctx.font = '600 38px Rubik, Arial, sans-serif'; ctx.fillText('aquí va el video viral', W / 2, H / 2 + 110); ctx.globalAlpha = 1;
}

export function drawFrame(ctx, sh, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [a, b, n] of sh.videos) if (t >= a && t < b) { drawVideo(ctx, n); return; }
  let cam;
  if (sh.single) cam = { x: charState(sh.chars[0], t, 0).x, y: 0.5, z: 820 };
  else cam = { x: sh.camT.x(t), y: sh.camT.y(t), z: sh.camT.z(t) };
  const toScreen = (wx, wz) => {
    const f = persp(wz);
    return { x: W / 2 + (wx - cam.x) * cam.z * f, y: H / 2 - (wz * 0.55 - cam.y) * cam.z, S: cam.z * f };
  };
  const g0 = toScreen(0, 0);
  drawBackground(ctx, g0.y, cam.z);
  if (sh.single) {
    // marcas en el suelo para que se note el desplazamiento al andar
    ctx.fillStyle = 'rgba(120,95,90,0.12)';
    for (let k = Math.floor(cam.x - 2); k <= cam.x + 2; k += 0.5) { const p = toScreen(k, -0.35); ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const items = [];
  sh.chars.forEach((c, i) => {
    const st = charState(c, t, i);
    if (!st.visible) return;
    items.push({ wz: st.wz, draw: () => { const p = toScreen(st.x, st.wz); drawToon(ctx, { x: p.x, y: p.y, S: p.S, phi: st.phi, pal: st.pal, pose: st.pose, face: st.face, tilt: st.tilt, sq: st.sq }); } });
  });
  if (!sh.single) items.push({ wz: PHONE[1], draw: () => { const p = toScreen(PHONE[0], PHONE[1]); drawPhone(ctx, p.x, p.y, p.S); } });
  items.sort((a, b) => b.wz - a.wz);
  for (const it of items) it.draw();
  if (sh.labels) {
    for (const [a, b, text] of sh.labels) {
      if (t < a || t >= b) continue;
      const al = clamp((t - a) / 0.25) * clamp((b - t) / 0.25);
      ctx.globalAlpha = al; ctx.fillStyle = '#2a2220'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = '700 46px Rubik, Arial, sans-serif'; ctx.fillText(text, W / 2, 150); ctx.globalAlpha = 1;
    }
  }
}
