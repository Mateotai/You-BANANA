// Plátano 2D ARTICULADO (para que pueda caminar, sentarse y levantarse).
// Mismo diseño que el 2D calcado: cuerpo, tallo, colores y cara de la foto.
// Los brazos y las piernas son tubos curvos del mismo amarillo que salen del cuerpo
// sin cortes: un único contorno exterior para todo (sin bolas en las articulaciones).
// Coordenadas locales = las del calco (src/banana2d-data.js): y negativa hacia arriba.
import { TRACE } from './banana2d-data.js';

export const COL = {
  shadow: '#efb300',
  base: '#ffcd1c',
  light: '#ffe24a',
  crease: 'rgba(176, 112, 0, 0.55)',
  outline: '#3d2a0c',
  stem: '#8b3d1b',
  stemLight: '#ad5a30',
  stemDark: '#5c250f',
  face: '#141414',
};
const OUT = 4.5; // grosor del contorno exterior

// ---------------------------------------------------------------- cuerpo (sin brazos ni piernas)
const BODY = [
  [-52, -655], [-110, -590], [-155, -505], [-183, -410], [-190, -300], [-186, -190], [-170, -112],
  [-140, -64], [-90, -37], [-20, -27], [50, -34], [110, -62], [150, -115], [168, -200], [165, -300],
  [148, -380], [126, -440], [110, -520], [96, -590], [80, -646], [40, -662], [0, -668],
];
// sombra (lomo) y luz (frente), como en el calco
const SHADE_EDGE = [[-20, -700], [-75, -520], [-102, -400], [-112, -300], [-102, -150], [-62, -55], [-20, -10]];
const LIGHT = [
  [22, -650], [-18, -540], [-38, -420], [-44, -330], [-22, -200], [30, -110], [100, -80], [140, -140],
  [150, -230], [146, -310], [128, -380], [106, -445], [92, -520], [80, -590], [62, -640],
];

// curva suave y cerrada por una lista de puntos (Catmull-Rom -> Bézier)
function smoothClosed(ctx, P) {
  const n = P.length;
  const g = (i) => P[(i + n) % n];
  ctx.moveTo(g(0)[0], g(0)[1]);
  for (let i = 0; i < n; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
}
function tracePath(ctx, contours) {
  for (const a of contours) {
    const n = a.length / 2;
    const px = (i) => a[((i + n) % n) * 2], py = (i) => a[((i + n) % n) * 2 + 1];
    ctx.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
    for (let i = 0; i < n; i++) ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    ctx.closePath();
  }
}
const bodyPath = (ctx) => { ctx.beginPath(); smoothClosed(ctx, BODY); };

// ---------------------------------------------------------------- extremidades
// Una extremidad es una curva suave raíz -> codo/rodilla -> mano/tobillo (-> punta del pie).
function sampleLimb(pts, n = 28) {
  // Catmull-Rom abierta por los puntos de control
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const segs = pts.length - 1;
  for (let s = 0; s < segs; s++) {
    const p0 = P[s], p1 = P[s + 1], p2 = P[s + 2], p3 = P[s + 3];
    const m = Math.ceil(n / segs);
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function polyline(ctx, S, from = 0) {
  const i0 = Math.floor(from * (S.length - 1));
  ctx.beginPath();
  ctx.moveTo(S[i0][0], S[i0][1]);
  for (let i = i0 + 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]);
}
function strokeLimb(ctx, S, w, color, from = 0, dx = 0, dy = 0) {
  ctx.save();
  ctx.translate(dx, dy);
  polyline(ctx, S, from);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
function fillLimb(ctx, L) {
  strokeLimb(ctx, L.S, L.w, COL.shadow);
  strokeLimb(ctx, L.S, L.w * 0.8, COL.base, 0, -L.w * 0.08, -L.w * 0.06);
  ctx.globalAlpha = 0.55;
  strokeLimb(ctx, L.S, L.w * 0.24, COL.light, 0.08, -L.w * 0.2, -L.w * 0.17);
  ctx.globalAlpha = 1;
}

// Dibuja una extremidad que "nace" del cuerpo: se funde suavemente en la raíz
// (máscara con degradado), así no queda ni un corte ni una bola en el hombro o la cadera.
let layer = null, mask = null;
const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
function limbFromBody(ctx, L, crease) {
  const c = ctx.canvas;
  if (!layer || layer.width !== c.width || layer.height !== c.height) { layer = mkCanvas(c.width, c.height); mask = mkCanvas(c.width, c.height); }
  const T = ctx.getTransform();
  const g = layer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, layer.width, layer.height);
  g.setTransform(T);
  if (crease) {
    g.save(); bodyPath(g); g.clip();
    strokeLimb(g, L.S, L.w + 7, COL.crease, 0);
    g.restore();
  }
  fillLimb(g, L);
  // máscara: fuera del cuerpo, opaca; dentro, transparente en la raíz -> opaca a ~1,3 grosores
  const m = mask.getContext('2d');
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.fillStyle = '#000';
  m.fillRect(0, 0, mask.width, mask.height);
  m.setTransform(T);
  const [rx, ry] = L.S[0];
  const R = L.w * 1.35;
  const grad = m.createRadialGradient(rx, ry, R * 0.25, rx, ry, R);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  m.save();
  bodyPath(m); m.clip();
  m.globalCompositeOperation = 'copy';
  m.fillStyle = grad;
  m.fillRect(rx - 3000, ry - 3000, 6000, 6000);
  m.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- poses
const lerp = (a, b, k) => a + (b - a) * k;
const lerpPt = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const W = { farArm: 50, nearArm: 56, farLeg: 62, nearLeg: 66 };
const ROOT = { farArm: [116, -425], nearArm: [-168, -335], farLeg: [70, -55], nearLeg: [-20, -48] };

// Sentado abrazando las rodillas (= la figura / el calco)
const SIT = {
  farArm: [ROOT.farArm, [200, -320], [186, -196]],
  nearArm: [ROOT.nearArm, [-60, -255], [98, -188]],
  farLeg: [[75, -60], [125, -262], [172, -58], [205, -34]],
  nearLeg: [[10, -50], [50, -232], [86, -30], [124, -6]],
};

// cinemática inversa de 2 huesos: rodilla/codo hacia el lado "bend" (+1 delante)
function ik(root, end, l1, l2, bend) {
  const dx = end[0] - root[0], dy = end[1] - root[1];
  let d = Math.hypot(dx, dy);
  const dmax = l1 + l2 - 0.5;
  const ux = dx / (d || 1), uy = dy / (d || 1);
  if (d > dmax) d = dmax;
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1))));
  const s = Math.sin(a * bend), c = Math.cos(a * bend);
  return [root[0] + (ux * c - uy * s) * l1, root[1] + (ux * s + uy * c) * l1];
}

// De pie / caminando. phase: fase de la zancada (radianes); amp: 0 = quieto, 1 = andando
export function standPose(phase = 0, amp = 0, sway = 0) {
  const P = {};
  const LEG = 255; // largo de la pierna (cadera -> tobillo) de pie
  for (const [k, off] of [['nearLeg', 0], ['farLeg', Math.PI]]) {
    const root = ROOT[k];
    const ph = phase + off;
    const sx = 62 * Math.sin(ph) * amp;
    const lift = Math.max(0, Math.cos(ph)) * 42 * amp;
    const ankle = [root[0] + 6 + sx, root[1] + LEG - lift];
    const knee = ik(root, ankle, 132, 132, 1);
    P[k] = [root, knee, ankle, [ankle[0] + 34, ankle[1] + 6 - lift * 0.2]];
  }
  // brazos colgando, balanceándose al revés que las piernas
  const swing = Math.sin(phase) * amp * 0.35 + sway;
  const arm = (root, side, len, sw) => {
    const hand = [root[0] + side * 14 + Math.sin(sw) * len, root[1] + Math.cos(sw) * len];
    const elbow = ik(root, hand, len * 0.52, len * 0.52, -side);
    return [root, elbow, hand];
  };
  P.nearArm = arm(ROOT.nearArm, -1, 230, -swing);
  P.farArm = arm(ROOT.farArm, 1, 215, swing);
  return P;
}
export function sitPose() { return { ...SIT, front: true }; }
// front: piernas y brazo cercano por delante del cuerpo (sentado) o por detrás (de pie)
export function blendPose(A, B, k) {
  const out = { front: k < 0.5 ? !!A.front : !!B.front };
  for (const key of ['farArm', 'nearArm', 'farLeg', 'nearLeg']) {
    const a = A[key], b = B[key];
    const n = Math.max(a.length, b.length);
    out[key] = Array.from({ length: n }, (_, i) => lerpPt(a[Math.min(i, a.length - 1)], b[Math.min(i, b.length - 1)], k));
  }
  return out;
}

// ---------------------------------------------------------------- cara
const [E1, E2] = TRACE.eyes;
const MOUTH = TRACE.mouth;
const FACE_ANGLE = Math.atan2(E2[1] - E1[1], E2[0] - E1[0]);
export const FACE_CENTER = { x: (E1[0] + E2[0] + MOUTH.a[0] + MOUTH.b[0]) / 4, y: (E1[1] + E2[1] + MOUTH.a[1] + MOUTH.b[1]) / 4 };

function drawFace(ctx, f) {
  const lx = (f.lookX || 0) * 7, ly = (f.lookY || 0) * 9;
  ctx.fillStyle = COL.face;
  ctx.strokeStyle = COL.face;
  for (const [x, y, r] of TRACE.eyes) {
    ctx.save();
    ctx.translate(x + lx, y + ly);
    ctx.rotate(FACE_ANGLE);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, Math.max(1.8, r * (1 - (f.blink || 0) * 0.88)), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // boca: raya recta -> "U invertida" (∩) según f.frown (0..1)
  const a = [MOUTH.a[0] + lx * 0.6, MOUTH.a[1] + ly * 0.6], b = [MOUTH.b[0] + lx * 0.6, MOUTH.b[1] + ly * 0.6];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const nx = dy / len, ny = -dx / len; // normal hacia "arriba" de la cara
  const up = ny < 0 ? 1 : -1;
  const fr = f.frown || 0;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  // las comisuras bajan y el centro sube
  const ca = [a[0] - nx * up * 6 * fr + (a[0] - mx) * 0.08 * fr, a[1] - ny * up * 6 * fr + (a[1] - my) * 0.08 * fr];
  const cb = [b[0] - nx * up * 6 * fr + (b[0] - mx) * 0.08 * fr, b[1] - ny * up * 6 * fr + (b[1] - my) * 0.08 * fr];
  const ctrl = [mx + nx * up * 30 * fr, my + ny * up * 30 * fr];
  ctx.lineCap = 'round';
  ctx.lineWidth = MOUTH.width;
  ctx.beginPath();
  ctx.moveTo(ca[0], ca[1]);
  ctx.quadraticCurveTo(ctrl[0], ctrl[1], cb[0], cb[1]);
  ctx.stroke();
}

// ---------------------------------------------------------------- dibujo
// pose: { farArm, nearArm, farLeg, nearLeg } (listas de puntos); face: { lookX, lookY, blink, frown }
export function drawBanana(ctx, pose, face = {}) {
  const L = {};
  for (const k of ['farArm', 'nearArm', 'farLeg', 'nearLeg']) L[k] = { S: sampleLimb(pose[k]), w: W[k] };

  // 1) contorno exterior de TODO junto (cuerpo + extremidades + tallo): una sola silueta
  ctx.save();
  ctx.strokeStyle = COL.outline; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const k of Object.keys(L)) strokeLimb(ctx, L[k].S, L[k].w + OUT * 2, COL.outline);
  bodyPath(ctx); ctx.lineWidth = OUT * 2; ctx.stroke();
  ctx.beginPath(); tracePath(ctx, TRACE.stem); ctx.lineWidth = OUT * 2; ctx.stroke();
  ctx.restore();

  // 2) lo que va por detrás (el cuerpo lo tapa limpio, sin uniones), cuerpo y tallo
  const front = !!pose.front;
  fillLimb(ctx, L.farArm);
  if (!front) for (const k of ['farLeg', 'nearLeg', 'nearArm']) fillLimb(ctx, L[k]);
  bodyPath(ctx); ctx.fillStyle = COL.shadow; ctx.fill();
  ctx.save();
  bodyPath(ctx); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(400, -720); for (const p of SHADE_EDGE) ctx.lineTo(p[0], p[1]); ctx.lineTo(400, 40); ctx.closePath();
  ctx.fillStyle = COL.base; ctx.fill();
  ctx.beginPath(); smoothClosed(ctx, LIGHT); ctx.fillStyle = COL.light; ctx.fill();
  ctx.restore();
  for (const [key, col] of [['stem', COL.stem], ['stemLight', COL.stemLight], ['stemDark', COL.stemDark]]) {
    ctx.beginPath(); tracePath(ctx, TRACE[key]); ctx.fillStyle = col; ctx.fill('evenodd');
  }

  // 3) piernas y brazo de delante; el pliegue sólo donde pasan por encima del cuerpo
  if (front) for (const k of ['farLeg', 'nearLeg', 'nearArm']) limbFromBody(ctx, L[k], true);

  drawFace(ctx, face);
}
