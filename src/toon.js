// Plátano 2D "toon" según la hoja de personaje: cuerpo de alubia alargada con contorno
// negro, sombra suave en el lado de atrás, tallo marrón cuadrado, brazos y piernas
// cortitos y redondeados, y caras sencillas (puntos + raya).
// Se modela en "3D de juguete" (secciones a lo largo de una columna curva) y se proyecta
// según el giro phi: 0 = de frente, +PI/2 = de perfil mirando a la derecha, PI = de espaldas.
// Unidades: alto del cuerpo = 1 (sin tallo ni piernas).

export const PALETTES = {
  yellow: { base: '#ffd51f', shade: '#f2b705', light: '#ffe35c' },
  green: { base: '#a9d86c', shade: '#86bf4b', light: '#c3e88f' },
  pink: { base: '#ff9fc6', shade: '#f27aa8', light: '#ffc2db' },
  blue: { base: '#7fd0ff', shade: '#55b3ea', light: '#a9e0ff' },
};
const INK = '#1d1915';
const STEM = { top: '#a86338', a: '#8a4723', b: '#6c3417' };
const RX = 0.3, RZ = 0.25, LEAN = 0.15, ELEV = 0.2; // ELEV: la cámara mira un poco desde arriba
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;

function prof(y) {
  let b = 1;
  if (y < 0.24) b = Math.pow(Math.max(0, 1 - Math.pow((0.24 - y) / 0.24, 2.2)), 1 / 2.2);
  const tp = y < 0.3 ? 1 : 1 - 0.62 * Math.pow((y - 0.3) / 0.7, 1.8);
  return b * tp;
}
const rx = (y) => RX * prof(y);
const rz = (y) => RZ * prof(y);
const cz = (y) => LEAN * Math.pow(Math.max(0, y), 2.2) - 0.035 * Math.sin(Math.PI * clamp(y));
const dcz = (y) => (cz(y + 0.01) - cz(y - 0.01)) / 0.02;

// ---------------------------------------------------------------- proyección
// C = { x, y (suelo en pantalla), S (px por unidad), phi, base (altura de la base del cuerpo), tilt }
function proj(C, p) {
  // inclinación del cuerpo hacia delante (alrededor de su base)
  let [x, y, z] = p;
  if (C.tilt && !p.free) {
    const c = Math.cos(C.tilt), s = Math.sin(C.tilt);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  y += C.base;
  const X = x * Math.cos(C.phi) + z * Math.sin(C.phi);
  const Z = -x * Math.sin(C.phi) + z * Math.cos(C.phi);
  return { x: C.x + X * C.S, y: C.y - (y - Z * Math.sin(ELEV) * 0.35) * C.S, z: Z };
}
const surf = (y, a) => [rx(y) * Math.sin(a), y, cz(y) + rz(y) * Math.cos(a)];
// cuánto mira hacia la cámara la superficie en (y, a): >0 visible
function facing(C, y, a) {
  const nx = Math.sin(a) / RX, nz = Math.cos(a) / RZ;
  const l = Math.hypot(nx, nz);
  return (-nx * Math.sin(C.phi) + nz * Math.cos(C.phi)) / l;
}

// ---------------------------------------------------------------- cuerpo
function bodyOutline(C) {
  const N = 56, L = [], R = [];
  const w = (y) => Math.sqrt((rx(y) * Math.cos(C.phi)) ** 2 + (rz(y) * Math.sin(C.phi)) ** 2);
  for (let i = 0; i <= N; i++) {
    const y = i / N;
    const c = proj(C, [0, y, cz(y)]);
    const ww = w(y) * C.S;
    // en la tapa (debajo del tallo) cerramos recto
    L.push([c.x - ww, c.y]);
    R.push([c.x + ww, c.y]);
  }
  return [...R, ...L.reverse()];
}
function pathFrom(ctx, pts) {
  ctx.beginPath();
  const n = pts.length;
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function drawStem(ctx, C) {
  // caja marrón algo estrechada, siguiendo la inclinación de la punta
  const top = [0, 0.985, cz(0.985)];
  const ang = Math.atan(dcz(0.98));
  const up = [0, Math.cos(ang), Math.sin(ang)], fw = [0, -Math.sin(ang), Math.cos(ang)], rt = [1, 0, 0];
  const hw = 0.092, hd = 0.088, h = 0.125;
  const P = (sx, sy, sz, k = 1) => {
    const p = [0, 1, 2].map((i) => top[i] + rt[i] * sx * hw * k + up[i] * sy * h + fw[i] * sz * hd * k);
    return proj(C, p);
  };
  const v = {};
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { v[`b${sx}${sz}`] = P(sx, -0.25, sz); v[`t${sx}${sz}`] = P(sx, 1, sz, 0.9); }
  const faces = [
    { pts: ['t-1-1', 't1-1', 't11', 't-11'], n: up, col: STEM.top },
    { pts: ['b-11', 'b11', 't11', 't-11'], n: fw, col: STEM.a },
    { pts: ['b-1-1', 'b1-1', 't1-1', 't-1-1'], n: fw.map((x) => -x), col: STEM.a },
    { pts: ['b11', 'b1-1', 't1-1', 't11'], n: rt, col: STEM.b },
    { pts: ['b-11', 'b-1-1', 't-1-1', 't-11'], n: rt.map((x) => -x), col: STEM.b },
  ];
  // visibles: normal girada hacia la cámara
  const vis = faces.map((f) => {
    let [x, y, z] = f.n;
    if (C.tilt) { const c = Math.cos(C.tilt), s = Math.sin(C.tilt); [y, z] = [y * c - z * s, y * s + z * c]; }
    const Z = -x * Math.sin(C.phi) + z * Math.cos(C.phi);
    return { ...f, d: Z + y * 0.35 };
  }).filter((f) => f.d > 0.02);
  ctx.lineJoin = 'round';
  for (const f of vis) {
    ctx.beginPath();
    f.pts.forEach((k, i) => (i ? ctx.lineTo(v[k].x, v[k].y) : ctx.moveTo(v[k].x, v[k].y)));
    ctx.closePath();
    // el lado de la luz más claro
    ctx.fillStyle = f.col;
    ctx.fill();
    ctx.lineWidth = C.S * 0.011; ctx.strokeStyle = INK; ctx.stroke();
  }
}

// ---------------------------------------------------------------- cara
// expr: 'neutral' | 'frown' (U invertida) | 'smile' | 'o' | 'open' | 'closed'
function drawFace(ctx, C, F) {
  const EY = 0.7 + (F.lookY || 0) * 0.012, MY = EY - 0.075;
  const lx = (F.lookX || 0) * 0.09;
  const inkW = C.S * 0.0115;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ojos
  for (const s of [-1, 1]) {
    const a = s * 0.25 + lx;
    const f = facing(C, EY, a);
    if (f < 0.12) continue;
    const p = proj(C, surf(EY, a));
    const r = C.S * 0.019;
    const fx = clamp(f, 0.35, 1);
    if (F.expr === 'closed') {
      ctx.lineWidth = inkW;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.4, r * 1.25 * fx, r * 0.9, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * fx, Math.max(r * 0.12, r * (1 - (F.blink || 0) * 0.9)), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // boca: curva sobre la superficie
  const mc = facing(C, MY, lx);
  if (mc < 0.15) return;
  const L = 0.055; // media longitud
  const pts = [];
  const bend = F.expr === 'frown' ? 1 : F.expr === 'smile' ? -1 : 0;
  for (let i = 0; i <= 12; i++) {
    const u = -L + (2 * L * i) / 12;
    const v = bend * 0.022 * (1 - (u / L) ** 2) - bend * 0.006;
    pts.push(proj(C, surf(MY + v, lx + u / rx(MY))));
  }
  const cen = proj(C, surf(MY, lx));
  const fx = clamp(mc, 0.35, 1);
  ctx.lineWidth = inkW;
  if (F.expr === 'o') {
    ctx.beginPath(); ctx.ellipse(cen.x, cen.y + C.S * 0.005, C.S * 0.014 * fx, C.S * 0.016, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (F.expr === 'open') {
    const w = C.S * 0.03 * fx, h = C.S * 0.03;
    ctx.beginPath(); ctx.moveTo(cen.x - w, cen.y - h * 0.25); ctx.lineTo(cen.x + w, cen.y - h * 0.25);
    ctx.bezierCurveTo(cen.x + w, cen.y + h, cen.x - w, cen.y + h, cen.x - w, cen.y - h * 0.25); ctx.closePath();
    ctx.fillStyle = '#ffeaa0'; ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
}

// ---------------------------------------------------------------- brazos y piernas
function ik(root, end, a, b) {
  // rodilla/codo en el plano y-z, doblando hacia delante (+z)
  const dy = end[1] - root[1], dz = end[2] - root[2];
  let d = Math.hypot(dy, dz);
  const dd = Math.min(d, a + b - 1e-4);
  const al = (a * a - b * b + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, a * a - al * al));
  const uy = dy / (d || 1), uz = dz / (d || 1);
  return [lerp(root[0], end[0], al / (dd || 1)), root[1] + uy * al + uz * h, root[2] + uz * al - uy * h];
}
function limbPath(ctx, C, pts3) {
  const P = pts3.map((p) => proj(C, p));
  ctx.beginPath();
  ctx.moveTo(P[0].x, P[0].y);
  if (P.length === 2) ctx.lineTo(P[1].x, P[1].y);
  for (let i = 1; i < P.length - 1; i++) {
    const m = i === P.length - 2 ? P[i + 1] : { x: (P[i].x + P[i + 1].x) / 2, y: (P[i].y + P[i + 1].y) / 2 };
    ctx.quadraticCurveTo(P[i].x, P[i].y, m.x, m.y);
  }
  return P;
}
function drawLimb(ctx, C, pal, pts3, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  limbPath(ctx, C, pts3); ctx.lineWidth = (w + 0.022) * C.S; ctx.strokeStyle = INK; ctx.stroke();
  limbPath(ctx, C, pts3); ctx.lineWidth = w * C.S; ctx.strokeStyle = pal.shade; ctx.stroke();
  ctx.save(); ctx.translate(C.S * 0.008, -C.S * 0.006);
  limbPath(ctx, C, pts3); ctx.lineWidth = w * 0.72 * C.S; ctx.strokeStyle = pal.base; ctx.stroke();
  ctx.restore();
}

// pose: { walk (fase), amp, sit (0..1), point (0..1, brazo cercano señalando), wave }
function limbsFor(C, pose) {
  const out = [];
  const sit = pose.sit || 0, amp = (pose.amp || 0) * (1 - sit), ph = pose.walk || 0;
  for (const s of [-1, 1]) {
    // piernas
    const hip = [s * 0.1, 0.06, 0.03];
    const lph = ph + (s > 0 ? Math.PI : 0);
    const ankStand = [s * 0.105, -0.16 + Math.max(0, Math.cos(lph)) * 0.06 * amp, 0.03 + 0.1 * Math.sin(lph) * amp];
    const kneeStand = ik(hip, ankStand, 0.115, 0.115);
    const toeStand = [ankStand[0], ankStand[1] - 0.005, ankStand[2] + 0.07];
    const S3 = [[s * 0.085, 0.07, 0.1], [s * 0.085, 0.33, 0.32], [s * 0.09, 0.07, 0.43], [s * 0.095, 0.05, 0.51]];
    const st = [hip, kneeStand, ankStand, toeStand];
    const leg = st.map((p, i) => p.map((v, j) => lerp(v, S3[i][j], sit)));
    // los pies de pie van detrás del cuerpo; sentado, las rodillas van delante
    const lz = proj(C, leg[1]).z;
    out.push({ kind: 'leg', pts: leg, w: lerp(0.115, 0.15, sit), depth: sit > 0.5 ? lz + 0.2 : -1 });
    // brazos
    const ys = 0.44;
    const sh = [s * rx(ys) * 0.93, ys, cz(ys) + 0.0];
    const sw = -0.09 * Math.sin(ph + (s > 0 ? 0 : Math.PI)) * amp;
    let elbow = [s * (rx(0.32) + 0.035), 0.31, 0.02 + sw * 0.5], hand = [s * (rx(0.2) + 0.03), 0.18, 0.04 + sw];
    const sE = [s * (rx(0.32) + 0.03), 0.33, 0.2], sH = [s * 0.05, 0.28, 0.47];
    elbow = elbow.map((v, j) => lerp(v, sE[j], sit));
    hand = hand.map((v, j) => lerp(v, sH[j], sit));
    // brazo cercano señalando / llamando
    const near = Math.sign(-Math.sin(C.phi) || 1) * -1; // lado más cerca de la cámara
    if (pose.point && s === near) {
      const k = pose.point;
      const wv = Math.sin((pose.t || 0) * 12) * 0.03 * (pose.wave || 0);
      elbow = elbow.map((v, j) => lerp(v, [s * (rx(0.4) + 0.02), 0.42, 0.2][j], k));
      hand = hand.map((v, j) => lerp(v, [s * (rx(0.4) + 0.0), 0.47 + wv, 0.46][j], k));
    }
    const shZ = proj(C, sh).z;
    out.push({ kind: 'arm', pts: [sh, elbow, hand], w: 0.088, depth: sit > 0.5 ? proj(C, hand).z + 0.3 : shZ > 0.02 ? 1 : -1 });
  }
  return out;
}

// ---------------------------------------------------------------- dibujar un plátano
// opts: { x, y, S, phi, pal, pose, face, tilt, shadow }
export function drawToon(ctx, o) {
  const pose = o.pose || {};
  const sit = pose.sit || 0;
  const bob = Math.abs(Math.sin(pose.walk || 0)) * 0.025 * (pose.amp || 0) * (1 - sit);
  const C = { x: o.x, y: o.y, S: o.S, phi: o.phi, tilt: o.tilt || 0, base: lerp(0.215, 0.0, sit) + bob };
  const pal = o.pal || PALETTES.yellow;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(70,45,30,.18)';
    ctx.beginPath(); ctx.ellipse(o.x + o.S * 0.02, o.y + o.S * 0.01, o.S * lerp(0.3, 0.42, sit), o.S * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  const limbs = limbsFor(C, { ...pose, t: o.t });
  const back = limbs.filter((l) => l.depth < 0), front = limbs.filter((l) => l.depth >= 0).sort((a, b) => a.depth - b.depth);
  for (const l of back) drawLimb(ctx, C, pal, l.pts, l.w);

  // cuerpo: sombra suave en el lado de atrás + contorno
  const outline = bodyOutline(C);
  pathFrom(ctx, outline);
  ctx.fillStyle = pal.shade; ctx.fill();
  ctx.save();
  pathFrom(ctx, outline); ctx.clip();
  ctx.filter = `blur(${Math.round(o.S * 0.018)}px)`;
  ctx.translate(o.S * 0.055, -o.S * 0.01);
  pathFrom(ctx, outline); ctx.fillStyle = pal.base; ctx.fill();
  ctx.filter = 'none';
  ctx.restore();
  pathFrom(ctx, outline);
  ctx.lineWidth = o.S * 0.012; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();

  drawStem(ctx, C);
  const faceVisible = Math.cos(o.phi) > -0.15;
  if (faceVisible) drawFace(ctx, C, o.face || {});
  for (const l of front) drawLimb(ctx, C, pal, l.pts, l.w);
  // cabeza en pantalla (para bocadillos)
  return proj(C, [0, 1.05, cz(1)]);
}
