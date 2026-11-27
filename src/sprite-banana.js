// Plátano 2D hecho con los dibujos de la hoja de personaje.
// Cada pose = capa de color (la del dibujo, recoloreada) + líneas negras en vector + cara aparte
// (ojos y boca dibujados encima, para poder parpadear y poner la boca en U invertida).
import { SPRITES } from './sprites-data.js';

const INK = '#0b0402';
const imgs = {};
const paths = {};

export async function loadSprites() {
  const jobs = [];
  for (const [name, p] of Object.entries(SPRITES.poses)) {
    // todos los contornos en un solo trazado (los agujeros se rellenan con "evenodd")
    const path = new Path2D();
    paths[name] = [path];
    p.ink.forEach((a) => {
      const n = a.length / 2;
      // contorno suavizado (curvas por los puntos medios)
      const X = (i) => a[((i + n) % n) * 2], Y = (i) => a[((i + n) % n) * 2 + 1];
      path.moveTo((X(-1) + X(0)) / 2, (Y(-1) + Y(0)) / 2);
      for (let i = 0; i < n; i++) path.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      path.closePath();
    });
    for (const [pal, src] of Object.entries(p.img)) {
      const im = new Image();
      im.src = new URL(src, import.meta.url).href;
      imgs[`${name}_${pal}`] = im;
      jobs.push(im.decode());
    }
  }
  await Promise.all(jobs);
}
export const poseInfo = (name) => SPRITES.poses[name];

// o = { pose, pal, x, y (punto de apoyo en pantalla), s (escala: px de pantalla por px del dibujo),
//       flip (true = mirando al otro lado), rot, sx, sy (aplastar/estirar),
//       face: { blink, frown, lookX, lookY }, part: { clip, pivot, rot } (para mover el brazo) }
export function drawSprite(ctx, o) {
  const P = SPRITES.poses[o.pose];
  const im = imgs[`${o.pose}_${o.pal || 'yellow'}`] || imgs[`${o.pose}_yellow`];
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.rot) ctx.rotate(o.rot);
  const k = o.s * (P.norm || 1);
  ctx.scale((o.flip ? -1 : 1) * k * (o.sx || 1), k * (o.sy || 1));
  ctx.translate(-P.anchor[0], -P.anchor[1]);
  const body = () => {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, P.w, P.h);
    ctx.fillStyle = INK;
    for (const p of paths[o.pose]) ctx.fill(p, 'evenodd');
  };
  if (o.part) {
    // la pose se parte en dos: el cuerpo y el brazo (que gira alrededor del hombro)
    const { clip, pivot, rot } = o.part;
    ctx.save(); ctx.beginPath(); ctx.rect(-1000, -1000, 3000, 3000); ctx.rect(clip[0], clip[1], clip[2], clip[3]); ctx.clip('evenodd'); body(); ctx.restore();
    ctx.save(); ctx.translate(pivot[0], pivot[1]); ctx.rotate(rot); ctx.translate(-pivot[0], -pivot[1]);
    ctx.beginPath(); ctx.rect(clip[0], clip[1], clip[2], clip[3]); ctx.clip(); body(); ctx.restore();
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
