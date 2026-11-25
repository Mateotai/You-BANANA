// Plátano estilo 2D (cartoon con contorno), dibujado con Canvas 2D.
// Coordenadas locales: origen en la base del cuerpo, y negativa hacia arriba,
// ~790 px de alto (calcado de la foto de producto 15/17).

const OUTLINE = '#3b2a12';
const PAL = {
  yellow: { base: [255, 212, 59], shade: [238, 176, 10], light: [255, 236, 140] },
  green: { base: [108, 190, 98], shade: [72, 150, 74], light: [160, 222, 140] },
};
const STEM = { base: '#8a4b2f', top: '#b0663f', shade: '#6b3822' };

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// Posición de la cara y del plátano en pantalla
const BASE = { x: 500, y: 1770, scale: 1.0 };
const FACE = { x: 72, y: -448 };
const ZOOM_TARGET = { x: 540, y: 930 };

function bodyPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-30, -668);
  ctx.bezierCurveTo(-95, -580, -160, -440, -168, -300);
  ctx.bezierCurveTo(-176, -170, -150, -40, -60, -10);
  ctx.bezierCurveTo(10, 10, 110, 6, 160, -24);
  ctx.bezierCurveTo(200, -110, 196, -240, 180, -300);
  ctx.bezierCurveTo(165, -380, 120, -480, 102, -540);
  ctx.bezierCurveTo(90, -580, 72, -605, 56, -612);
  ctx.closePath();
}

function limb(ctx, pts, w, col, { smoothJoin = true } = {}) {
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3 && smoothJoin) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 12; ctx.stroke();
  draw(); ctx.strokeStyle = rgb(col.base); ctx.lineWidth = w; ctx.stroke();
  // brillo sutil
  ctx.save();
  ctx.translate(-w * 0.12, -w * 0.16);
  draw(); ctx.strokeStyle = rgb(col.light); ctx.globalAlpha = 0.55; ctx.lineWidth = w * 0.28; ctx.stroke();
  ctx.restore();
}

function blob(ctx, x, y, rx, ry, rot, col) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, 0, rx + 6, ry + 6, 0, 0, Math.PI * 2); ctx.fillStyle = OUTLINE; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = rgb(col.base); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-rx * 0.25, -ry * 0.3, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgb(col.light); ctx.globalAlpha = 0.6; ctx.fill();
  ctx.restore();
}

function drawStem(ctx) {
  ctx.save();
  ctx.translate(16, -622);
  ctx.rotate(0.5);
  ctx.lineJoin = 'round';
  const w = 92, h = 100;
  // cara frontal
  const r = 14;
  const rr = (x, y, w2, h2) => { ctx.beginPath(); ctx.roundRect(x, y, w2, h2, r); };
  rr(-w / 2, -h, w, h); ctx.fillStyle = STEM.base; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUTLINE; ctx.stroke();
  // cara superior (perspectiva)
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, -h + 4);
  ctx.lineTo(-w / 2 + 26, -h - 30);
  ctx.lineTo(w / 2 + 16, -h - 30);
  ctx.lineTo(w / 2 - 4, -h + 4);
  ctx.closePath();
  ctx.fillStyle = STEM.top; ctx.fill(); ctx.stroke();
  // cara lateral
  ctx.beginPath();
  ctx.moveTo(w / 2 - 2, -h + 4);
  ctx.lineTo(w / 2 + 18, -h - 28);
  ctx.lineTo(w / 2 + 18, -32);
  ctx.lineTo(w / 2 - 2, -4);
  ctx.closePath();
  ctx.fillStyle = STEM.shade; ctx.fill(); ctx.stroke();
  // líneas de impresión 3D
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  for (let y = -h + 12; y < -6; y += 11) { ctx.beginPath(); ctx.moveTo(-w / 2 + 6, y); ctx.lineTo(w / 2 - 6, y); ctx.stroke(); }
  ctx.restore();
}

function drawFace(ctx, s) {
  ctx.save();
  ctx.translate(FACE.x, FACE.y);
  ctx.rotate(-0.36); // la cara sigue la inclinación del plátano
  const lx = s.lookX * 9, ly = s.lookY * 11;
  const r = 11 * s.eyeScale;
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#111';
  ctx.lineCap = 'round';
  for (const ex of [-37, 37]) {
    ctx.save();
    ctx.translate(ex + lx, -10 + ly);
    const open = 1 - s.blink * 0.88;
    ctx.beginPath(); ctx.ellipse(0, 0, r, Math.max(1.6, r * open), 0, 0, Math.PI * 2); ctx.fill();
    if (s.eyeScale > 1.2 && open > 0.5) { // brillito en modo shock
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.fillStyle = '#111';
    }
    ctx.restore();
  }
  // boca
  ctx.save();
  ctx.translate(lx * 0.5, 34 + ly * 0.5);
  ctx.lineWidth = 9;
  if (s.mouth === 'line') {
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.stroke();
  } else if (s.mouth === 'o') {
    ctx.beginPath(); ctx.ellipse(0, 4, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
  } else if (s.mouth === 'wavy') {
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const x = -30 + i * 2.5; const y = Math.sin(i * 0.8) * 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawSweat(ctx, p) {
  if (p < 0) return;
  const x = -112 + p * 10, y = -560 + p * 140;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(10, -16, 20, -2, 20, 10);
  ctx.arc(0, 10, 20, 0, Math.PI);
  ctx.bezierCurveTo(-20, -2, -10, -16, 0, -34);
  ctx.fillStyle = '#9fe1ff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#2a6f9e'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-7, 6, 4, 7, 0.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}

function drawPedestal(ctx) {
  ctx.save();
  // lateral
  ctx.beginPath();
  ctx.ellipse(40, 80, 400, 78, 0, 0, Math.PI);
  ctx.lineTo(-360, 10);
  ctx.ellipse(40, 10, 400, 78, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#eadccd'; ctx.fill();
  // tapa
  ctx.beginPath(); ctx.ellipse(40, 10, 400, 78, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -70, 0, 90);
  g.addColorStop(0, '#fffaf4'); g.addColorStop(1, '#f2e6d8');
  ctx.fillStyle = g; ctx.fill();
  // sombra de contacto
  ctx.save();
  ctx.translate(40, 6); ctx.scale(1, 0.2);
  const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
  sg.addColorStop(0, 'rgba(120,80,40,.4)'); sg.addColorStop(1, 'rgba(120,80,40,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 260, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawBanana(ctx, s) {
  const col = {
    base: mix(PAL.yellow.base, PAL.green.base, s.green),
    shade: mix(PAL.yellow.shade, PAL.green.shade, s.green),
    light: mix(PAL.yellow.light, PAL.green.light, s.green),
  };

  drawStem(ctx); // detrás del cuerpo para que quede "encajado"
  // brazo lejano (detrás del cuerpo)
  limb(ctx, [[150, -400], [222, -300], [218, -196]], 32, col);

  // cuerpo
  bodyPath(ctx);
  ctx.lineWidth = 12; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = rgb(col.base); ctx.fill();
  ctx.save();
  bodyPath(ctx); ctx.clip();
  // sombra lateral izquierda (lomo del plátano)
  ctx.beginPath();
  ctx.moveTo(-30, -680);
  ctx.bezierCurveTo(-60, -560, -110, -420, -105, -280);
  ctx.bezierCurveTo(-100, -150, -70, -60, -20, 0);
  ctx.lineTo(-300, 0); ctx.lineTo(-300, -700); ctx.closePath();
  ctx.fillStyle = rgb(col.shade); ctx.fill();
  // brillo en la arista delantera
  ctx.beginPath();
  ctx.moveTo(60, -600);
  ctx.bezierCurveTo(100, -520, 140, -420, 150, -330);
  ctx.lineWidth = 16; ctx.strokeStyle = rgb(col.light); ctx.globalAlpha = 0.8; ctx.lineCap = 'round'; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // pierna lejana: la rodilla es la punta redondeada de la espinilla
  limb(ctx, [[150, -262], [190, -50]], 54, col);
  blob(ctx, 212, -22, 42, 25, 0.35, col);
  // mano lejana agarrando la rodilla
  blob(ctx, 208, -200, 22, 24, 0, col);
  // pierna cercana
  limb(ctx, [[48, -236], [90, -30]], 58, col);
  blob(ctx, 122, 4, 46, 26, 0.3, col);
  // brazo cercano (por delante de las rodillas)
  limb(ctx, [[-128, -330], [-50, -200], [96, -150]], 36, col);
  blob(ctx, 104, -150, 25, 23, 0, col);

  drawFace(ctx, s);
  drawSweat(ctx, s.sweat);
}

export async function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    render(s) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // cámara: interpola entre plano general y primerísimo plano de la cara
      const z = s.zoom * BASE.scale;
      const fBase = { x: BASE.x + FACE.x * BASE.scale, y: BASE.y + FACE.y * BASE.scale };
      const fx = fBase.x + (ZOOM_TARGET.x - fBase.x) * s.zoomFocus + s.shake.x;
      const fy = fBase.y + (ZOOM_TARGET.y - fBase.y) * s.zoomFocus + s.shake.y;
      ctx.translate(fx, fy);
      ctx.scale(z, z);
      ctx.translate(-FACE.x, -FACE.y);
      drawPedestal(ctx);
      ctx.save();
      // balanceo sobre la base + respiración
      ctx.translate(30, 0);
      ctx.rotate(s.rock);
      ctx.scale(1 - s.breath * 0.5, 1 + s.breath);
      ctx.translate(-30, 0);
      drawBanana(ctx, s);
      ctx.restore();
    },
  };
}
