// Plátano estilo 2D: ilustración plana calcada de la foto de producto (vista 15/17).
// Silueta, tonos, pliegues y tallo salen de src/banana2d-data.js (scripts/trace_reference.py).
// Es una sola pieza, igual que la figura: sin contornos entre brazos, piernas y cuerpo.
import { TRACE } from './banana2d-data.js';

const COL = {
  shadow: '#efb300',
  base: '#ffcd1c',
  light: '#ffe24a',
  crease: 'rgba(190, 124, 0, 0.7)',
  outline: '#3d2a0c',
  stem: '#8b3d1b',
  stemLight: '#ad5a30',
  stemDark: '#5c250f',
  face: '#141414',
};

// colocación en pantalla (1080x1920)
const BASE = { x: 528, y: 1792, scale: 1.06 };
const [E1, E2] = TRACE.eyes;
const M = TRACE.mouth;
const FACE = { x: (E1[0] + E2[0] + M.a[0] + M.b[0]) / 4, y: (E1[1] + E2[1] + M.a[1] + M.b[1]) / 4 };
const FACE_ANGLE = Math.atan2(E2[1] - E1[1], E2[0] - E1[0]);
const ZOOM_TARGET = { x: 540, y: 930 };
const PIVOT = { x: 10, y: 0 };

// contorno suavizado (curvas cuadráticas por los puntos medios)
function addContour(ctx, a) {
  const n = a.length / 2;
  const px = (i) => a[((i + n) % n) * 2], py = (i) => a[((i + n) % n) * 2 + 1];
  ctx.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
  ctx.closePath();
}
function layer(ctx, contours, fill) {
  ctx.beginPath();
  for (const c of contours) addContour(ctx, c);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
}

function drawFace(ctx, s) {
  const lx = s.lookX * 7, ly = s.lookY * 9;
  ctx.fillStyle = COL.face;
  ctx.strokeStyle = COL.face;
  for (const [x, y, r] of TRACE.eyes) {
    ctx.save();
    ctx.translate(x + lx, y + ly);
    ctx.rotate(FACE_ANGLE);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, Math.max(1.8, r * (1 - s.blink * 0.88)), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = M.width;
  ctx.beginPath();
  ctx.moveTo(M.a[0] + lx * 0.6, M.a[1] + ly * 0.6);
  ctx.lineTo(M.b[0] + lx * 0.6, M.b[1] + ly * 0.6);
  ctx.stroke();
}

function drawSweat(ctx, p) {
  if (p < 0) return;
  const x = -38 - p * 8, y = -560 + p * 110;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.15);
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.bezierCurveTo(9, -14, 18, -2, 18, 9);
  ctx.arc(0, 9, 18, 0, Math.PI);
  ctx.bezierCurveTo(-18, -2, -9, -14, 0, -30);
  ctx.fillStyle = '#a6e4ff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2a6f9e'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-6, 6, 3.5, 6, 0.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}

function drawPedestal(ctx) {
  const cx = 10, cy = -4, rx = 360, ry = 74, side = 70;
  ctx.beginPath();
  ctx.ellipse(cx, cy + side, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#eadccd'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, '#fffaf4'); g.addColorStop(1, '#f1e4d5');
  ctx.fillStyle = g; ctx.fill();
  // sombra de contacto
  ctx.save();
  ctx.translate(20, -6); ctx.scale(1, 0.2);
  const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 250);
  sg.addColorStop(0, 'rgba(120,80,40,.42)'); sg.addColorStop(1, 'rgba(120,80,40,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 250, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBanana(ctx, s) {
  layer(ctx, TRACE.silhouette, COL.shadow);
  layer(ctx, TRACE.base, COL.base);
  layer(ctx, TRACE.light, COL.light);
  layer(ctx, TRACE.crease, COL.crease);
  layer(ctx, TRACE.stem, COL.stem);
  layer(ctx, TRACE.stemLight, COL.stemLight);
  layer(ctx, TRACE.stemDark, COL.stemDark);
  // un único contorno exterior: la figura es una sola pieza
  ctx.beginPath();
  for (const c of TRACE.silhouette) addContour(ctx, c);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = COL.outline;
  ctx.stroke();
  drawFace(ctx, s);
  drawSweat(ctx, s.sweat);
}

export async function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    render(s) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // cámara: plano general <-> primerísimo plano de la cara
      const fBase = { x: BASE.x + FACE.x * BASE.scale, y: BASE.y + FACE.y * BASE.scale };
      const fx = fBase.x + (ZOOM_TARGET.x - fBase.x) * s.zoomFocus + s.shake.x;
      const fy = fBase.y + (ZOOM_TARGET.y - fBase.y) * s.zoomFocus + s.shake.y;
      ctx.translate(fx, fy);
      ctx.scale(s.zoom * BASE.scale, s.zoom * BASE.scale);
      ctx.translate(-FACE.x, -FACE.y);
      drawPedestal(ctx);
      ctx.save();
      // balanceo sobre la base + respiración + leve inclinación al mirar arriba
      ctx.translate(PIVOT.x, PIVOT.y);
      ctx.rotate(s.rock - s.lean * 0.04);
      ctx.scale(1 - s.breath * 0.5, 1 + s.breath);
      ctx.translate(-PIVOT.x, -PIVOT.y);
      drawBanana(ctx, s);
      ctx.restore();
    },
  };
}
