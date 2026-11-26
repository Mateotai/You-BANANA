// "Programa" de reacciones en cadena con el plátano 2D articulado.
// Dos formatos:
//   sofa: el viral ocupa toda la mitad de arriba; abajo el plátano llega andando,
//         se sienta en el sofá y reacciona con la boca en "U invertida" al acabar cada video.
//   pie:  el plátano de pie a pantalla completa mira a un lado; al girarse, el viral
//         aparece a pantalla completa; al acabar vuelve el plátano, pone la "U invertida",
//         se gira al otro lado y entra el siguiente video.
import { drawBanana, standPose, sitPose, blendPose } from './banana-rig.js';

export const W = 1080, H = 1920, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (t0, t1, t) => { const x = clamp((t - t0) / (t1 - t0)); return x * x * (3 - 2 * x); };
const pulse = (t0, d, t) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : 1 - Math.abs(x * 2 - 1); };

// ---------------------------------------------------------------- guion
// cfg = { format, items: [{ len, kind: 'video'|'placeholder', ... }] }
export function buildShow(cfg) {
  const items = cfg.items;
  const sh = { format: cfg.format, items, plays: [], reacts: [], cues: [] };
  const R = cfg.react ?? 1.5; // duración de la reacción entre videos
  if (cfg.format === 'sofa') {
    sh.walk = [0, 2.4];
    sh.hop = [2.4, 2.95];
    let t = 3.1;
    items.forEach((it, i) => {
      sh.plays.push([t, t + it.len]);
      t += it.len;
      sh.reacts.push([t, t + R]);
      t += R;
    });
    sh.duration = t + 0.4;
    for (let k = 0.25; k < sh.walk[1]; k += 0.25) sh.cues.push({ t: k, type: 'step', gain: 0.6 });
    sh.cues.push({ t: sh.hop[0], type: 'boing', gain: 0.7 }, { t: sh.hop[1] - 0.05, type: 'thud', gain: 0.8 });
  } else {
    sh.intro = 1.3;
    let t = sh.intro;
    sh.turns = [];
    items.forEach((it, i) => {
      sh.turns.push([t, t + 0.28]); // se gira...
      t += 0.38; // ...y corte al video
      sh.plays.push([t, t + it.len]);
      sh.cues.push({ t: t - 0.06, type: 'whoosh', gain: 0.7 });
      t += it.len;
      const r = i === items.length - 1 ? R + 0.4 : R;
      sh.reacts.push([t, t + r]);
      t += r;
    });
    sh.duration = t;
  }
  for (const [a] of sh.reacts) sh.cues.push({ t: a + 0.06, type: 'womp', gain: 0.8 });
  return sh;
}

// qué se ve en el instante t
export function stateAt(sh, t) {
  const s = { t, item: -1, videoTime: 0, videoMode: 'none', look: { lookX: 0, lookY: 0, blink: 0, frown: 0 } };
  let playing = -1, reacting = -1;
  sh.plays.forEach(([a, b], i) => { if (t >= a && t < b) playing = i; });
  sh.reacts.forEach(([a, b], i) => { if (t >= a && t < b) reacting = i; });
  s.playing = playing; s.reacting = reacting;

  // parpadeos regulares + uno lento en cada reacción
  let blink = 0;
  for (let bt = 0.9; bt < sh.duration; bt += 2.7) blink = Math.max(blink, pulse(bt, 0.16, t));
  for (const [a] of sh.reacts) blink = Math.max(blink, pulse(a + 0.75, 0.42, t));
  s.look.blink = blink;

  // la cara de "U invertida" al acabar cada video
  let frown = 0;
  for (const [a, b] of sh.reacts) frown = Math.max(frown, smooth(a, a + 0.15, t) * (1 - smooth(b - 0.2, b - 0.05, t)));
  s.look.frown = frown;

  if (sh.format === 'sofa') {
    // video arriba: antes de empezar se ve el primer fotograma en pausa
    if (playing >= 0) { s.item = playing; s.videoTime = t - sh.plays[playing][0]; s.videoMode = 'play'; }
    else if (reacting >= 0) { s.item = reacting; s.videoTime = sh.items[reacting].len - 0.01; s.videoMode = 'frozen'; }
    else if (t < sh.plays[0][0]) { s.item = 0; s.videoTime = 0; s.videoMode = 'waiting'; }
    else { s.item = sh.items.length - 1; s.videoTime = sh.items[s.item].len - 0.01; s.videoMode = 'frozen'; }

    // mirada: arriba (al video) mientras se reproduce; a cámara en las reacciones
    let lookUp = smooth(sh.hop[1], sh.hop[1] + 0.3, t);
    for (const [a, b] of sh.reacts) lookUp -= smooth(a, a + 0.12, t) * (1 - smooth(b - 0.2, b, t));
    s.look.lookY = -clamp(lookUp);
    s.look.lookX = 0.25 * Math.sin(t * 1.3) * clamp(lookUp);
  } else {
    s.videoMode = playing >= 0 ? 'full' : 'none';
    if (playing >= 0) { s.item = playing; s.videoTime = t - sh.plays[playing][0]; }
    // hacia dónde mira: empieza mirando a la izquierda y alterna en cada giro
    let facing = -1, turnK = 0;
    sh.turns.forEach(([a, b], i) => {
      const dir = i % 2 === 0 ? 1 : -1; // giro i: hacia +1 (derecha) o -1
      if (t >= b) facing = dir;
      else if (t >= a) { turnK = (t - a) / (b - a); facing = lerp(-dir, dir, turnK); }
    });
    s.facing = facing;
    s.turnK = turnK;
    // anticipación: antes de girarse mira de reojo hacia el otro lado
    let side = 0;
    for (const [a] of sh.turns) side = Math.max(side, smooth(a - 0.45, a - 0.3, t) * (1 - smooth(a + 0.1, a + 0.2, t)));
    s.look.lookX = -side;
  }
  return s;
}

// ---------------------------------------------------------------- dibujo de escenas
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function drawRoom(ctx) {
  // pared y suelo del salón (mitad de abajo)
  const wall = ctx.createLinearGradient(0, 960, 0, 1600);
  wall.addColorStop(0, '#f6d9cb'); wall.addColorStop(1, '#f1c9b8');
  ctx.fillStyle = wall; ctx.fillRect(0, 960, W, 640);
  ctx.fillStyle = '#e4b48a'; ctx.fillRect(0, 1600, W, 320);
  ctx.fillStyle = 'rgba(120,70,30,.08)';
  for (let y = 1640; y < H; y += 70) ctx.fillRect(0, y, W, 4);
  ctx.fillStyle = '#f9e6dc'; ctx.fillRect(0, 1588, W, 16); // rodapié
  // lámpara y planta
  ctx.fillStyle = '#6b4a3a'; ctx.fillRect(64, 1230, 10, 380);
  ctx.fillStyle = '#ffe7a3'; ctx.beginPath(); ctx.moveTo(20, 1240); ctx.lineTo(118, 1240); ctx.lineTo(96, 1150); ctx.lineTo(42, 1150); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,231,163,.22)'; ctx.beginPath(); ctx.arc(69, 1250, 130, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c96f4a'; rr(ctx, 975, 1500, 80, 100, 14); ctx.fill();
  ctx.fillStyle = '#4f9a6a';
  for (const [dx, dy, r] of [[0, -40, 34], [-26, -70, 26], [26, -76, 28], [0, -110, 24]]) { ctx.beginPath(); ctx.ellipse(1015 + dx, 1500 + dy, r * 0.7, r, dx * 0.02, 0, Math.PI * 2); ctx.fill(); }
}
function drawSofa(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(80,40,20,.18)'; ctx.beginPath(); ctx.ellipse(540, 1712, 430, 30, 0, 0, Math.PI * 2); ctx.fill();
  const c = { back: '#3f7fa6', seat: '#4b8fb8', arm: '#36739a', base: '#2f6488', leg: '#5a3b28' };
  ctx.fillStyle = c.leg; rr(ctx, 190, 1690, 26, 30, 6); ctx.fill(); rr(ctx, 864, 1690, 26, 30, 6); ctx.fill();
  ctx.fillStyle = c.back; rr(ctx, 170, 1250, 740, 330, 60); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, 200, 1270, 330, 260, 46); ctx.fill(); rr(ctx, 550, 1270, 330, 260, 46); ctx.fill();
  ctx.fillStyle = c.base; rr(ctx, 150, 1590, 780, 110, 24); ctx.fill();
  ctx.fillStyle = c.seat; rr(ctx, 200, 1515, 340, 105, 30); ctx.fill(); rr(ctx, 540, 1515, 340, 105, 30); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 214, 1522, 312, 26, 13); ctx.fill(); rr(ctx, 554, 1522, 312, 26, 13); ctx.fill();
  ctx.fillStyle = c.arm; rr(ctx, 112, 1400, 130, 300, 52); ctx.fill(); rr(ctx, 838, 1400, 130, 300, 52); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(ctx, 126, 1410, 100, 40, 20); ctx.fill(); rr(ctx, 852, 1410, 100, 40, 20); ctx.fill();
  ctx.restore();
}
function drawPlainWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fbe3d3'); g.addColorStop(0.78, '#f5cdbd'); g.addColorStop(0.78, '#e8bd97'); g.addColorStop(1, '#ddb08a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(180, 380, 170, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,170,180,.25)'; ctx.beginPath(); ctx.arc(930, 640, 210, 0, Math.PI * 2); ctx.fill();
}

// imagen del viral (cover, centrado en focusY) o un marcador "VIDEO n"
function drawVideo(ctx, it, img, x, y, w, h, dim = 0) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#060606'; ctx.fillRect(x, y, w, h);
  if (img && img.naturalWidth) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const k = Math.max(w / iw, h / ih);
    const sw = w / k, sh = h / k;
    const fy = it.focusY ?? 0.5;
    const sx = (iw - sw) / 2, sy = clamp((ih - sh) * fy, 0, ih - sh);
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(Math.min(w, h) * 0.16)}px Rubik, Arial, sans-serif`;
    ctx.fillText(it.text || 'VIDEO', x + w / 2, y + h / 2);
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.035)}px Rubik, Arial, sans-serif`;
    ctx.globalAlpha = 0.5; ctx.fillText('aquí va otro video viral', x + w / 2, y + h / 2 + Math.min(w, h) * 0.13);
  }
  if (dim) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}
function playIcon(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(cx - 28, cy - 42); ctx.lineTo(cx + 46, cy); ctx.lineTo(cx - 28, cy + 42); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// plátano con transformación: x, y = punto de apoyo; sc = escala; flip = -1..1 (mirando a izq./der.)
function placeBanana(ctx, x, y, sc, flip, rot, pose, look, squash = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc * flip, sc * squash);
  drawBanana(ctx, pose, look);
  ctx.restore();
}

export function drawShow(ctx, sh, s, frameImg) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const t = s.t;
  const it = s.item >= 0 ? sh.items[s.item] : null;

  if (sh.format === 'sofa') {
    drawVideo(ctx, it, frameImg, 0, 0, W, 960, s.videoMode === 'waiting' ? 0.45 : s.videoMode === 'frozen' ? 0.12 : 0);
    if (s.videoMode === 'waiting') playIcon(ctx, 540, 480);
    ctx.fillStyle = '#1b1210'; ctx.fillRect(0, 956, W, 8);
    drawRoom(ctx);
    drawSofa(ctx);

    const SC = 0.72, SEAT = [540, 1562], FLOOR_Y = 1800 - 244 * SC;
    let x, y, pose, squash = 1, rot = 0;
    if (t < sh.walk[1]) {
      const k = (t - sh.walk[0]) / (sh.walk[1] - sh.walk[0]);
      x = lerp(-230, 540, k);
      const ph = t * Math.PI * 2 / 0.5;
      y = FLOOR_Y - Math.abs(Math.sin(ph)) * 10;
      pose = standPose(ph, 1 - smooth(sh.walk[1] - 0.25, sh.walk[1], t));
      rot = Math.sin(ph) * 0.03;
    } else if (t < sh.hop[1]) {
      const k = (t - sh.hop[0]) / (sh.hop[1] - sh.hop[0]);
      x = 540;
      y = lerp(FLOOR_Y, SEAT[1], k) - Math.sin(Math.PI * k) * 150;
      pose = blendPose(standPose(), sitPose(), smooth(0.15, 0.85, k));
      squash = 1 + 0.06 * Math.sin(Math.PI * k);
    } else {
      x = SEAT[0]; y = SEAT[1];
      pose = sitPose();
      const land = t - sh.hop[1];
      squash = 1 - 0.07 * Math.exp(-land * 10) * Math.cos(land * 30) + Math.sin(t * 2.2) * 0.006;
      // en la reacción ladea un poco el cuerpo
      let tilt = 0;
      for (const [a, b] of sh.reacts) tilt = Math.max(tilt, smooth(a, a + 0.15, t) * (1 - smooth(b - 0.2, b, t)));
      rot = -0.05 * tilt;
    }
    // sombra en el suelo mientras anda
    if (t < sh.hop[1]) { ctx.fillStyle = 'rgba(80,40,20,.2)'; ctx.beginPath(); ctx.ellipse(x + 30, 1805, 110, 16, 0, 0, Math.PI * 2); ctx.fill(); }
    placeBanana(ctx, x, y, SC, 1, rot, pose, s.look, squash);
  } else {
    if (s.videoMode === 'full') { drawVideo(ctx, it, frameImg, 0, 0, W, H); return; }
    drawPlainWall(ctx);
    const SC = 1.55, X = 560, Y = 1820 - 244 * SC;
    ctx.fillStyle = 'rgba(90,45,20,.22)'; ctx.beginPath(); ctx.ellipse(X + 20, 1815, 260, 34, 0, 0, Math.PI * 2); ctx.fill();
    const hopY = -Math.sin(Math.PI * s.turnK) * 40;
    const breath = Math.sin(t * 2.2) * 0.008;
    // giro rápido: se estrecha y cambia de lado (nunca queda plano como un papel)
    const flip = Math.sign(s.facing || 1) * Math.max(0.4, Math.abs(s.facing));
    placeBanana(ctx, X, Y + hopY, SC, flip, 0, standPose(0, 0, Math.sin(t * 1.7) * 0.05), s.look, 1 + breath);
  }
}
