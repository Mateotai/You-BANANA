// Plátano 2D hecho con los dibujos de la hoja de personaje.
// Cada pose = capa de color (la del dibujo, recoloreada) + líneas negras en vector + cara aparte
// (ojos y boca dibujados encima, para poder parpadear y poner la boca en U invertida).
import { SPRITES } from './sprites-data.js';

const INK = '#0b0402';
const imgs = {};
const geo = {};
let off = null; // lienzo auxiliar para doblar el brazo

// curva suave cerrada por los puntos medios
function closedPath(path, a) {
  const n = a.length / 2;
  const X = (i) => a[((i + n) % n) * 2], Y = (i) => a[((i + n) % n) * 2 + 1];
  path.moveTo((X(-1) + X(0)) / 2, (Y(-1) + Y(0)) / 2);
  for (let i = 0; i < n; i++) path.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
  path.closePath();
}
function openPath(path, a) {
  const n = a.length / 2;
  path.moveTo(a[0], a[1]);
  for (let i = 1; i < n - 1; i++) path.quadraticCurveTo(a[i * 2], a[i * 2 + 1], (a[i * 2] + a[i * 2 + 2]) / 2, (a[i * 2 + 1] + a[i * 2 + 3]) / 2);
  path.lineTo(a[(n - 1) * 2], a[(n - 1) * 2 + 1]);
}

export async function loadSprites() {
  const jobs = [];
  for (const [name, p] of Object.entries(SPRITES.poses)) {
    const sil = new Path2D();
    for (const c of p.sil || []) closedPath(sil, c);
    // líneas interiores: las de grosor completo van juntas; las que se afinan, por tramos
    const full = new Path2D(), taper = [];
    for (const L of p.lines || []) {
      if (L.w.every((w) => w > 0.99)) openPath(full, L.p);
      else taper.push(L);
    }
    geo[name] = { sil, full, taper, hasSil: (p.sil || []).length > 0 };
    for (const [pal, src] of Object.entries(p.img)) {
      const im = new Image();
      im.src = new URL(src, import.meta.url).href;
      imgs[`${name}_${pal}`] = im;
      jobs.push(im.decode());
    }
  }
  await Promise.all(jobs);
}

// dibuja la pose sin la cara: color + contorno exterior uniforme + líneas interiores
function drawBody(ctx, P, G, im) {
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, 0, 0, P.w, P.h);
  if (!G.hasSil) return;
  const lw = P.lw || 3.4;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  // contorno exterior: banda de grosor uniforme por dentro del borde
  ctx.save();
  ctx.clip(G.sil);
  ctx.lineWidth = lw * 2;
  ctx.stroke(G.sil);
  ctx.restore();
  // líneas interiores (brazos por delante del cuerpo, piernas...)
  ctx.lineWidth = lw;
  ctx.stroke(G.full);
  for (const L of G.taper) {
    const n = L.p.length / 2;
    for (let i = 1; i < n; i++) {
      ctx.lineWidth = lw * (L.w[i - 1] + L.w[i]) / 2;
      ctx.beginPath(); ctx.moveTo(L.p[i * 2 - 2], L.p[i * 2 - 1]); ctx.lineTo(L.p[i * 2], L.p[i * 2 + 1]); ctx.stroke();
    }
  }
}

export const poseInfo = (name) => SPRITES.poses[name];

// o = { pose, pal, x, y (punto de apoyo en pantalla), s (escala: px de pantalla por px del dibujo),
//       flip (true = mirando al otro lado), rot, sx, sy (aplastar/estirar),
//       face: { blink, frown, lookX, lookY }, part: { x0, x1, y0, y1, pivot, rot, ramp } (brazo que se dobla) }
export function drawSprite(ctx, o) {
  const P = SPRITES.poses[o.pose];
  const im = imgs[`${o.pose}_${o.pal || 'yellow'}`] || imgs[`${o.pose}_yellow`];
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.rot) ctx.rotate(o.rot);
  const k = o.s * (P.norm || 1);
  ctx.scale((o.flip ? -1 : 1) * k * (o.sx || 1), k * (o.sy || 1));
  ctx.translate(-P.anchor[0], -P.anchor[1]);
  const G = geo[o.pose];
  const body = () => drawBody(ctx, P, G, im);
  if (o.part) {
    // el brazo se DOBLA (no se corta): la pose se pinta una vez en un lienzo aparte y el brazo
    // se copia en tiras finas; cada tira gira un poco más que la anterior y en la raíz el giro
    // es 0, así nunca se separa del cuerpo
    const { x0, x1, y0, y1, pivot, rot, ramp } = o.part;
    const T = ctx.getTransform();
    const kk = Math.hypot(T.a, T.b) * 1.0;
    const ow = Math.ceil(P.w * kk) + 2, oh = Math.ceil(P.h * kk) + 2;
    if (!off) off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(ow, oh) : document.createElement('canvas');
    if (off.width < ow || off.height < oh) { off.width = Math.max(off.width, ow); off.height = Math.max(off.height, oh); }
    const g = off.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height);
    g.setTransform(kk, 0, 0, kk, 0, 0);
    drawBody(g, P, G, im);
    // cuerpo (sin la zona del brazo)
    ctx.save(); ctx.beginPath(); ctx.rect(-2000, -2000, 5000, 5000); ctx.rect(x0 + 0.5, y0, x1 - x0, y1 - y0); ctx.clip('evenodd');
    ctx.drawImage(off, 0, 0, P.w * kk, P.h * kk, 0, 0, P.w, P.h);
    ctx.restore();
    // brazo en tiras
    const dx = 1.2;
    for (let x = x0; x < x1; x += dx) {
      const u = Math.min(1, Math.max(0, (x + dx / 2 - x0) / ramp));
      const th = rot * u * u * (3 - 2 * u);
      const w = dx + 0.6;
      ctx.save();
      ctx.translate(pivot[0], pivot[1]); ctx.rotate(th); ctx.translate(-pivot[0], -pivot[1]);
      ctx.drawImage(off, x * kk, y0 * kk, w * kk, (y1 - y0) * kk, x, y0, w, y1 - y0);
      ctx.restore();
    }
  } else body();
  if (P.face) drawFace(ctx, P.face, o.face || {}, o.flip);
  ctx.restore();
}

function drawFace(ctx, F, f, flipped) {
  const lx = (f.lookX || 0) * (flipped ? -1 : 1) * 3.2, ly = (f.lookY || 0) * 3.2;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  const [e1, e2] = F.eyes;
  const ang = Math.atan2(e2[1] - e1[1], e2[0] - e1[0]);
  const r = Math.max(e1[2], e2[2]) * 1.02;
  for (const [x, y] of [e1, e2]) {
    ctx.save();
    ctx.translate(x + lx, y + ly); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, r, Math.max(0.6, r * (1 - (f.blink || 0) * 0.9)), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // boca: raya -> U invertida (las comisuras bajan, el centro sube)
  const { a, b, w } = F.mouth;
  const fr = f.frown || 0;
  const mx = (a[0] + b[0]) / 2 + lx * 0.6, my = (a[1] + b[1]) / 2 + ly * 0.6;
  const dx = (b[0] - a[0]) / 2, dy = (b[1] - a[1]) / 2;
  const len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len; // normal "hacia arriba"
  const k = 1 - 0.18 * fr;
  const drop = 2.6 * fr, rise = 3.2 * fr;
  ctx.lineWidth = w * 1.05;
  ctx.beginPath();
  ctx.moveTo(mx - dx * k - nx * drop, my - dy * k - ny * drop);
  ctx.quadraticCurveTo(mx + nx * rise * 2, my + ny * rise * 2, mx + dx * k - nx * drop, my + dy * k - ny * drop);
  ctx.stroke();
}
