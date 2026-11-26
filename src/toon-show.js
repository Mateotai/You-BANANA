// Prototipo 2D con el diseño de la hoja de personaje.
// 1) El plátano llega andando, se gira a cámara y se sienta delante del móvil.
// 2) Mira el móvil -> el viral sale a pantalla completa.
// 3) Vuelve: cara de U invertida. Llama con el brazo ("¡Ven!") y llega el plátano verde.
// 4) Se sientan los dos, miran el móvil -> siguiente video.
// 5) Vuelven: los dos ponen la U invertida a la vez.
import { drawToon, PALETTES } from './toon.js';

export const W = 1080, H = 1920, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (t0, t1, t) => { const x = clamp((t - t0) / (t1 - t0)); return x * x * (3 - 2 * x); };
const pulse = (t0, d, t) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : 1 - Math.abs(x * 2 - 1); };

export function buildShow(cfg) {
  const [v1, v2] = cfg.items;
  const T = {};
  T.walk = [0, 2.4]; T.turn = [2.4, 2.8]; T.sit = [3.3, 4.0]; T.look = [4.0, 4.6];
  T.play1 = [4.7, 4.7 + v1.len];
  const E1 = T.play1[1];
  T.react1 = [E1, E1 + 1.3];
  T.call = [E1 + 1.3, E1 + 3.3];
  T.bubble = [E1 + 1.45, E1 + 3.0];
  T.gwalk = [E1 + 1.6, E1 + 3.6];
  T.gsit = [E1 + 3.6, E1 + 4.3];
  T.look2 = [E1 + 4.3, E1 + 4.8];
  T.play2 = [E1 + 4.9, E1 + 4.9 + (v2 ? v2.len : 0)];
  const E2 = T.play2[1];
  T.react2 = [E2, E2 + 1.6];
  const sh = { items: cfg.items, T, duration: E2 + 1.9, plays: [T.play1, T.play2], cues: [] };
  const c = sh.cues;
  for (let s = 0.2; s < T.walk[1]; s += 0.275) c.push({ t: s, type: 'step', gain: 0.55 });
  c.push({ t: T.sit[0] + 0.35, type: 'thud', gain: 0.6 });
  c.push({ t: T.play1[0] - 0.06, type: 'whoosh', gain: 0.7 }, { t: T.react1[0] + 0.06, type: 'womp', gain: 0.8 });
  c.push({ t: T.bubble[0], type: 'whistle', gain: 0.8 }, { t: T.bubble[0], type: 'pop', gain: 0.5 });
  for (let s = T.gwalk[0] + 0.15; s < T.gwalk[1]; s += 0.275) c.push({ t: s, type: 'step', gain: 0.5 });
  c.push({ t: T.gsit[0] + 0.35, type: 'thud', gain: 0.6 });
  c.push({ t: T.play2[0] - 0.06, type: 'whoosh', gain: 0.7 }, { t: T.react2[0] + 0.06, type: 'womp', gain: 0.9 });
  return sh;
}

// sitios en el "mundo" (= píxeles con la cámara a zoom 1)
const FLOOR = 1640, YX = 330, GX = 975, PHONE = { x: 668, y: 1745 };
const SY = 760, SG = 700;

export function stateAt(sh, t) {
  const T = sh.T;
  const s = { t, playing: -1 };
  sh.plays.forEach(([a, b], i) => { if (t >= a && t < b) { s.playing = i; s.videoTime = t - a; } });

  // ---- plátano amarillo
  const y = { pal: PALETTES.yellow, S: SY, y: FLOOR, face: { expr: 'neutral' }, pose: {} };
  if (t < T.walk[1]) {
    const k = (t - T.walk[0]) / (T.walk[1] - T.walk[0]);
    y.x = lerp(-320, YX, k);
    y.phi = 1.0;
    y.pose = { walk: t * Math.PI * 2 / 0.55, amp: 1 - sm(0.85, 1, k) };
  } else {
    y.x = YX;
    y.phi = lerp(lerp(1.0, 0, sm(T.turn[0], T.turn[1], t)), 0.5, sm(T.sit[0], T.sit[1], t));
    y.pose = { sit: sm(T.sit[0], T.sit[1], t) };
  }
  // ---- plátano verde
  const g = { pal: PALETTES.green, S: SG, y: FLOOR - 10, face: { expr: 'neutral' }, pose: {}, visible: t >= T.gwalk[0] };
  if (t < T.gwalk[1]) {
    const k = clamp((t - T.gwalk[0]) / (T.gwalk[1] - T.gwalk[0]));
    g.x = lerp(1650, GX, k);
    g.phi = -1.0;
    g.pose = { walk: t * Math.PI * 2 / 0.55, amp: 1 - sm(0.85, 1, k) };
  } else {
    g.x = GX;
    g.phi = lerp(-1.0, -0.5, sm(T.gsit[0], T.gsit[1], t));
    g.pose = { sit: sm(T.gsit[0], T.gsit[1], t) };
  }

  // ---- caras y gestos
  let blinkY = 0, blinkG = 0;
  for (let b = 1.2; b < sh.duration; b += 2.8) blinkY = Math.max(blinkY, pulse(b, 0.16, t));
  for (let b = T.gwalk[1] + 0.4; b < sh.duration; b += 3.1) blinkG = Math.max(blinkG, pulse(b, 0.16, t));
  blinkY = Math.max(blinkY, pulse(T.turn[1] + 0.15, 0.18, t), pulse(T.react1[0] + 0.6, 0.4, t), pulse(T.react2[0] + 0.6, 0.4, t));
  blinkG = Math.max(blinkG, pulse(T.react2[0] + 0.65, 0.4, t));
  y.face.blink = blinkY; g.face.blink = blinkG;
  // mirar al móvil (abajo a la derecha / abajo a la izquierda)
  const look1 = sm(T.look[0], T.look[0] + 0.25, t) * (1 - sm(T.react1[0], T.react1[0] + 0.1, t));
  const look2 = sm(T.look2[0], T.look2[0] + 0.25, t) * (1 - sm(T.react2[0], T.react2[0] + 0.1, t));
  y.face.lookX = 0.5 * Math.max(look1, look2); y.face.lookY = -0.6 * Math.max(look1, look2);
  g.face.lookX = -0.5 * look2; g.face.lookY = -0.6 * look2;
  const lean = 0.06 * Math.max(look1, look2);
  // reacciones: U invertida y cuerpo un poco caído
  const r1 = sm(T.react1[0], T.react1[0] + 0.15, t) * (1 - sm(T.react1[1] - 0.15, T.react1[1], t));
  const r2 = sm(T.react2[0], T.react2[0] + 0.15, t);
  if (r1 > 0.5 || r2 > 0.5) y.face.expr = 'frown';
  if (r2 > 0.5) g.face.expr = 'frown';
  y.tilt = lean + 0.07 * Math.max(r1, r2);
  g.tilt = 0.05 * look2 + 0.07 * r2;
  // llamada: gira un poco hacia la derecha, extiende el brazo, boca abierta ("¡Ven!")
  const call = sm(T.call[0], T.call[0] + 0.3, t) * (1 - sm(T.call[1] - 0.3, T.call[1], t));
  y.phi = lerp(y.phi, 1.0, call);
  y.pose.point = call;
  y.pose.wave = call;
  if (t >= T.bubble[0] && t < T.bubble[1]) y.face.expr = 'open';
  // contento cuando llega el verde
  if (t >= T.gwalk[1] - 0.3 && t < T.look2[0]) y.face.expr = 'smile';
  if (t >= T.gsit[0] && t < T.gsit[1]) g.face.expr = 'o';

  s.yellow = y; s.green = g;
  s.bubble = t >= T.bubble[0] && t < T.bubble[1] ? clamp((t - T.bubble[0]) / 0.18) : 0;
  // cámara: más cerca al principio, se abre cuando llega el verde
  const open = sm(T.gwalk[0], T.gwalk[1], t);
  s.cam = { x: lerp(470, 640, open), y: lerp(1190, 1180, open), z: lerp(1.1, 0.86, open) };
  return s;
}

// ---------------------------------------------------------------- escena
function drawRoom(ctx) {
  const g = ctx.createLinearGradient(0, -600, 0, FLOOR);
  g.addColorStop(0, '#efe9e5'); g.addColorStop(1, '#e6dfda');
  ctx.fillStyle = g; ctx.fillRect(-2000, -2000, 6000, FLOOR + 2000);
  ctx.fillStyle = '#d9cfc9'; ctx.fillRect(-2000, FLOOR - 120, 6000, 4000);
  ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(-2000, FLOOR - 120, 6000, 6);
}
function drawPhone(ctx) {
  // móvil en un soporte, visto por detrás (como en la hoja)
  const { x, y } = PHONE;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.68, 0.68);
  ctx.fillStyle = 'rgba(60,40,30,.2)'; ctx.beginPath(); ctx.ellipse(0, 6, 120, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#1d1915';
  ctx.fillStyle = '#3b3a3d'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(10, -120); ctx.lineTo(60, -120); ctx.lineTo(40, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.rotate(0.12);
  ctx.fillStyle = '#4a494d'; ctx.beginPath(); ctx.roundRect(-70, -330, 150, 290, 26); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b2a2d'; ctx.beginPath(); ctx.roundRect(-46, -306, 50, 70, 16); ctx.fill();
  ctx.fillStyle = '#121113'; for (const [cx, cy] of [[-30, -286], [-14, -258]]) { ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawBubble(ctx, x, y, k, text) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1d1915'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(-10, -150, 330, 130, 60); ctx.moveTo(40, -24); ctx.lineTo(10, 30); ctx.lineTo(95, -24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(36, -30, 62, 12);
  ctx.fillStyle = '#1d1915'; ctx.font = '800 84px Rubik, Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, 155, -84);
  ctx.restore();
}
function drawVideo(ctx, it, img) {
  ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, H);
  if (img && img.naturalWidth) {
    const iw = img.naturalWidth, ih = img.naturalHeight, k = Math.max(W / iw, H / ih);
    const sw = W / k, shh = H / k, fy = it.focusY ?? 0.5;
    ctx.drawImage(img, (iw - sw) / 2, clamp((ih - shh) * fy, 0, ih - shh), sw, shh, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 170px Rubik, Arial, sans-serif'; ctx.fillText(it.text || 'VIDEO', W / 2, H / 2);
    ctx.font = '600 38px Rubik, Arial, sans-serif'; ctx.globalAlpha = 0.5; ctx.fillText('aquí va otro video viral', W / 2, H / 2 + 120); ctx.globalAlpha = 1;
  }
}

export function drawShow(ctx, sh, s, img) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.playing >= 0) { drawVideo(ctx, sh.items[s.playing], img); return; }
  ctx.translate(W / 2, H / 2); ctx.scale(s.cam.z, s.cam.z); ctx.translate(-s.cam.x, -s.cam.y);
  drawRoom(ctx);
  const opt = (b) => ({ x: b.x, y: b.y, S: b.S, phi: b.phi, pal: b.pal, pose: b.pose, face: b.face, tilt: b.tilt, t: s.t });
  if (s.green.visible) drawToon(ctx, opt(s.green));
  const head = drawToon(ctx, opt(s.yellow));
  drawPhone(ctx);
  if (s.bubble) drawBubble(ctx, head.x + 40, head.y - 10, s.bubble, '¡Ven!');
}
