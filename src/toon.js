// Plátano 2D calcado de la hoja de personaje (medidas y colores medidos en la imagen).
//
// Se modela como un volumen sencillo y se proyecta con una cámara un poco elevada, así
// puede girar de forma continua: phi = 0 de frente, +PI/2 perfil mirando a la derecha,
// PI de espaldas. Unidades: alto del cuerpo (base -> arranque del tallo) = 1.
//
// Dibujo (como en la hoja): una sola silueta con contorno negro; brazos y piernas se
// funden con el cuerpo (sin líneas en las uniones) y sólo se marca su contorno interior
// donde quedan por delante del cuerpo.

export const PALETTES = {
  yellow: { base: '#fed710', shade: '#f5ba08' },
  green: { base: '#b4d95f', shade: '#93c142' },
  pink: { base: '#ffacc9', shade: '#f387ad' },
  blue: { base: '#92d7ff', shade: '#63bbef' },
  purple: { base: '#cbaeff', shade: '#aa8cef' },
};
const INK = '#0b0503';
const OUT = 0.02; // grosor visible del contorno
const ELEV = 0.26, CE = Math.cos(ELEV), SE = Math.sin(ELEV);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const L3 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];

// ---------------------------------------------------------------- forma (medida en la hoja)
const HWMAX = 0.262; // (medida en la hoja menos el grosor del contorno)
export function hw(y) {
  if (y >= 0.3) return HWMAX - 0.139 * Math.pow(Math.min(1, (y - 0.3) / 0.7), 2.91);
  const d = (0.3 - y) / 0.33;
  return d >= 1 ? 0 : HWMAX * Math.pow(1 - Math.pow(d, 2.6), 1 / 2.6);
}
// columna: el lomo un poco hacia atrás y la punta hacia delante (como en el perfil de la hoja)
const cz = (y) => -0.025 + (y <= 0.45 ? 0 : 0.085 * ((Math.min(y, 1.2) - 0.45) / 0.55) ** 2);
const surf = (y, a) => [hw(y) * Math.sin(a), y, cz(y) + hw(y) * Math.cos(a)];

// ---------------------------------------------------------------- cámara del personaje
// C = { x, y: suelo en pantalla, S: px por unidad, phi, tilt, roll, sq, base }
function xf(C, p) {
  let [x, y, z] = p;
  if (y > 0) {
    const k = Math.min(1, y / 0.25);
    if (C.sq) { y *= 1 + C.sq; x *= 1 - C.sq * 0.5 * k; z *= 1 - C.sq * 0.5 * k; }
    const t = (C.tilt || 0) * k * (0.75 + 0.5 * Math.min(1, y)); // se dobla más arriba (como un plátano)
    if (t) { const c = Math.cos(t), s = Math.sin(t); [y, z] = [y * c - z * s, y * s + z * c]; }
    const r = (C.roll || 0) * k;
    if (r) { const c = Math.cos(r), s = Math.sin(r); [x, y] = [x * c - y * s, x * s + y * c]; }
  }
  return [x, y + C.base, z];
}
function proj(C, w) {
  const cp = Math.cos(C.phi), sp = Math.sin(C.phi);
  const X = w[0] * cp + w[2] * sp, Z = -w[0] * sp + w[2] * cp;
  return { x: C.x + X * C.S, y: C.y - (w[1] - Z * SE) * C.S, z: Z * CE + w[1] * SE };
}
const P = (C, p) => proj(C, xf(C, p));
// ¿cuánto mira a cámara una dirección (normal) del personaje?
function towardCam(C, n) {
  const a = xf({ ...C, base: 0 }, [n[0], n[1] + 1, n[2]]), o = xf({ ...C, base: 0 }, [0, 1, 0]);
  const d = [a[0] - o[0], a[1] - o[1], a[2] - o[2]];
  const Z = -d[0] * Math.sin(C.phi) + d[2] * Math.cos(C.phi);
  return Z * CE + d[1] * SE;
}

// ---------------------------------------------------------------- utilidades
function smoothPath(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  ctx.closePath();
}
function catmull(ctrl, per = 10) {
  const g = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  const out = [];
  for (let s = 0; s < ctrl.length - 1; s++) {
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const p0 = g(s - 1), p1 = g(s), p2 = g(s + 1), p3 = g(s + 2);
      out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
function strokePoly(ctx, pts, w, style) {
  poly(ctx, pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.5, w); ctx.strokeStyle = style; ctx.stroke();
}

// capas auxiliares (para fundir extremidades con el cuerpo)
let LA = null, LB = null, LM = null;
function layers(w, h) {
  const mk = () => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  if (!LA || LA.width !== w || LA.height !== h) { LA = mk(); LB = mk(); LM = mk(); }
  return [LA.getContext('2d'), LB.getContext('2d'), LM.getContext('2d')];
}

// ---------------------------------------------------------------- cuerpo
function bodyOutline(C) {
  const N = 60, R = [], Lft = [];
  const k = 1 - (C.sq || 0) * 0.5;
  for (let i = 0; i <= N; i++) {
    const y = -0.03 + (1.03 * i) / N;
    const c = P(C, [0, y, cz(y)]);
    const w = hw(y) * C.S * k;
    R.push([c.x + w, c.y]); Lft.push([c.x - w, c.y]);
  }
  const ct = P(C, [0, 1, cz(1)]), wt = hw(1) * C.S * k, top = [];
  for (let i = 1; i < 12; i++) { const t = (i / 12) * Math.PI; top.push([ct.x + wt * Math.cos(t), ct.y - wt * SE * Math.sin(t)]); }
  return [...R, ...top, ...Lft.reverse()];
}
function fillBody(ctx, C, out, pal) {
  smoothPath(ctx, out); ctx.fillStyle = pal.shade; ctx.fill();
  ctx.save();
  smoothPath(ctx, out); ctx.clip();
  ctx.filter = `blur(${Math.max(1, Math.round(C.S * 0.022))}px)`;
  ctx.translate(C.S * 0.06, -C.S * 0.04); // luz desde arriba a la derecha (como en la hoja)
  smoothPath(ctx, out); ctx.fillStyle = pal.base; ctx.fill();
  ctx.restore();
  ctx.filter = 'none';
}

// ---------------------------------------------------------------- tallo
function drawStem(ctx, C) {
  const tl = 0.45; // el tallo se inclina hacia delante
  const base = [0, 0.975, cz(0.975)];
  const up = [0, Math.cos(tl), Math.sin(tl)], fw = [0, -Math.sin(tl), Math.cos(tl)], rt = [1, 0, 0];
  const H = 0.155;
  const V = (sx, sy, sz) => {
    const w = sy > 0 ? 0.088 : 0.096;
    return P(C, [0, 1, 2].map((i) => base[i] + rt[i] * sx * w + up[i] * sy * H + fw[i] * sz * w));
  };
  const v = {};
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { v[`b${sx}${sz}`] = V(sx, -0.1, sz); v[`t${sx}${sz}`] = V(sx, 1, sz); }
  const F = [
    { k: ['b-11', 'b11', 't11', 't-11'], n: fw, c: '#84431e' },
    { k: ['b1-1', 'b-1-1', 't-1-1', 't1-1'], n: fw.map((x) => -x), c: '#84431e' },
    { k: ['b11', 'b1-1', 't1-1', 't11'], n: rt, c: '#5f2b11' },
    { k: ['b-1-1', 'b-11', 't-11', 't-1-1'], n: rt.map((x) => -x), c: '#5f2b11' },
    { k: ['t-11', 't11', 't1-1', 't-1-1'], n: up, c: '#c27041' },
  ].map((f) => ({ ...f, d: towardCam(C, f.n) })).filter((f) => f.d > 0.02);
  const path = (f) => { ctx.beginPath(); f.k.forEach((k, i) => (i ? ctx.lineTo(v[k].x, v[k].y) : ctx.moveTo(v[k].x, v[k].y))); ctx.closePath(); };
  ctx.lineJoin = 'round';
  for (const f of F) { path(f); ctx.lineWidth = OUT * 2 * C.S; ctx.strokeStyle = INK; ctx.stroke(); }
  for (const f of F) {
    path(f);
    if (f.n === up) ctx.fillStyle = f.c;
    else {
      const a = v[f.k[3]], b = v[f.k[0]];
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, f.c); g.addColorStop(1, f.c === '#84431e' ? '#733718' : '#52250e');
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.lineWidth = OUT * 0.55 * C.S; ctx.strokeStyle = 'rgba(11,5,3,.6)'; ctx.stroke();
  }
}

// ---------------------------------------------------------------- cara
// F = { lookX, lookY, blink (0..1), frown (0..1: raya -> U invertida) }
function drawFace(ctx, C, F) {
  const lx = F.lookX || 0, ly = F.lookY || 0;
  const EY = 0.714 + ly * 0.035, MY = 0.639 + ly * 0.03, la = lx * 0.22;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const a = la + s * 0.29;
    const f = towardCam(C, [Math.sin(a), 0, Math.cos(a)]);
    if (f < 0.08) continue;
    const p = P(C, surf(EY, a));
    const r = 0.022 * C.S;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * clamp(f * 1.2, 0.3, 1), Math.max(r * 0.14, r * (1 - (F.blink || 0) * 0.88)), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const fr = F.frown || 0;
  const A = lerp(0.28, 0.215, fr);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = -1 + (2 * i) / 16, a = la + u * A;
    if (towardCam(C, [Math.sin(a), 0, Math.cos(a)]) < 0.05) continue;
    const p = P(C, surf(MY + fr * (0.017 * (1 - u * u) - 0.004), a));
    pts.push(p);
  }
  if (pts.length > 1) strokePoly(ctx, pts, 0.021 * C.S, INK);
}

// ---------------------------------------------------------------- brazos y piernas
const frac = (x) => x - Math.floor(x);
export const STRIDE = 0.27; // media zancada (en unidades del cuerpo)
function rotX(v, t) { const c = Math.cos(t), s = Math.sin(t); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }

// pose = { walk (fase), amp, sit, hug, call, callSide, beck, slump }
function limbs(C, pose) {
  const sit = pose.sit || 0, amp = (pose.amp || 0) * (1 - sit), ph = pose.walk || 0;
  const side = Math.abs(Math.sin(C.phi));
  const gnd = -C.base; // suelo en coordenadas del cuerpo
  const out = [];
  const legZ = {};
  for (const s of [-1, 1]) {
    // ---------- pierna (el pie de apoyo se queda en el suelo)
    const u = frac(ph / (2 * Math.PI) + (s < 0 ? 0 : 0.5));
    let z, lift, pitch;
    if (u < 0.5) { z = lerp(STRIDE, -STRIDE, u / 0.5); lift = 0; pitch = 0; }
    else { const k = (u - 0.5) / 0.5, e = k * k * (3 - 2 * k); z = lerp(-STRIDE, STRIDE, e); lift = 0.09 * Math.sin(Math.PI * k); pitch = 0.6 * Math.sin(Math.PI * k); }
    z *= amp; lift *= amp; pitch *= amp;
    legZ[s] = z;
    const rL = lerp(0.068, 0.088, side) * lerp(1, 1.3, sit), rF = lerp(0.068, 0.06, side) * lerp(1, 1.2, sit);
    const hip = [s * 0.097, 0.06, 0.02];
    const ank = [s * 0.097, gnd + rL + lift, 0.02 + z];
    const d = Math.hypot(ank[1] - hip[1], ank[2] - hip[2]);
    const bend = Math.sqrt(Math.max(0, (0.19 / 2) ** 2 - (d / 2) ** 2)) * 1.4;
    const knee = [s * 0.097, (hip[1] + ank[1]) / 2, (hip[2] + ank[2]) / 2 + bend];
    // sentado: rodillas arriba, pies delante (las rodillas suben antes de bajar el cuerpo)
    const sitK = clamp(sit * 1.25);
    const hipS = [s * 0.1, 0.12, 0.06], kneeS = [s * 0.115, 0.37, 0.43], ankS = [s * 0.12, gnd + rL, 0.56];
    const H = L3(hip, hipS, sit), K = L3(knee, kneeS, sitK), A = L3(ank, ankS, sit);
    const toe = add(A, [0, rF - rL - pitch * 0.05, 0.12 - pitch * 0.02]);
    const knz = P(C, K).z - P(C, [0, K[1], cz(K[1])]).z;
    out.push({
      kind: 'leg', s, segs: [{ ctrl: [H, K, A], r: rL }, { ctrl: [A, toe], r: rF }],
      back: sit * clamp(0.5 - knz / 0.08), fade: lerp(0.6, 0.04, sit), z: P(C, A).z + sit * 0.3,
    });
  }
  for (const s of [-1, 1]) {
    // ---------- brazo
    const sh = [s * 0.215, 0.545, 0.0];
    let el = [s * 0.285, 0.38, 0.08], ha = [s * 0.262, 0.205, 0.19];
    // balanceo al andar (contrario a la pierna de su lado)
    const th = 1.25 * (legZ[s] / STRIDE);
    if (th) { el = add(sh, rotX([el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]], th)); ha = add(sh, rotX([ha[0] - sh[0], ha[1] - sh[1], ha[2] - sh[2]], th)); }
    const sitK = clamp(sit * 1.15 - 0.15);
    el = L3(el, [s * 0.3, 0.45, 0.27], sitK); ha = L3(ha, [s * 0.1, 0.4, 0.57], sitK);
    if (pose.slump) { el = L3(el, [s * 0.25, 0.33, 0.17], pose.slump); ha = L3(ha, [s * 0.16, 0.16, 0.27], pose.slump); }
    if (pose.hug) { el = L3(el, [s * 0.29, 0.42, 0.42], pose.hug); ha = L3(ha, [-s * 0.05, 0.41, 0.62], pose.hug); }
    if (pose.call && s === (pose.callSide || 1)) {
      const b = 0.5 + 0.5 * Math.sin(pose.beck || 0);
      el = L3(el, [s * 0.36, 0.53, 0.26], pose.call);
      ha = L3(ha, [s * 0.42, 0.58 + 0.09 * b, 0.6 - 0.08 * b], pose.call);
    }
    const rA = lerp(0.054, 0.074, side);
    const hz = P(C, ha).z - P(C, [0, ha[1], cz(ha[1])]).z;
    const ez = P(C, el).z - P(C, [0, el[1], cz(el[1])]).z;
    const zr = Math.max(hz, ez);
    out.push({
      kind: 'arm', s, segs: [{ ctrl: [sh, el, ha], r: rA }, { ctrl: [ha, ha], r: rA * 1.06 }],
      back: clamp(0.5 - zr / 0.08), fade: lerp(0.32, 0, clamp(side * 2.5 + sit)), z: P(C, ha).z + 1.0 * sit + 0.001,
    });
  }
  return out;
}

function limbScreen(C, L) {
  return L.segs.map((sg) => ({
    pts: catmull(sg.ctrl, 10).map((p) => {
      const q = P(C, p), yy = clamp(p[1], 0, 1);
      q.rd = q.z - P(C, [0, p[1], cz(yy)]).z; // >0 delante del eje del cuerpo, <0 detrás
      return q;
    }),
    r: sg.r * C.S,
  }));
}

function drawLimb(ctx, C, L, segs, pal, bodyPath) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  // caja de la extremidad
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const sg of segs) for (const p of sg.pts) { const m = sg.r + OUT * C.S + 4; x0 = Math.min(x0, p.x - m); y0 = Math.min(y0, p.y - m); x1 = Math.max(x1, p.x + m); y1 = Math.max(y1, p.y + m); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  const bw = x1 - x0, bh = y1 - y0;
  const [g, r] = layers(W, H);
  for (const c of [g, r]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(x0, y0, bw, bh); }
  // relleno con sombreado
  for (const sg of segs) strokePoly(g, sg.pts, sg.r * 2, pal.shade);
  g.save(); g.translate(0.22 * segs[0].r, -0.2 * segs[0].r);
  for (const sg of segs) strokePoly(g, sg.pts, sg.r * 1.4, pal.base);
  g.restore();
  // contorno interior (anillo), que se desvanece hacia la raíz
  for (const sg of segs) strokePoly(r, sg.pts, (sg.r + OUT * C.S) * 2, INK);
  r.globalCompositeOperation = 'destination-out';
  for (const sg of segs) strokePoly(r, sg.pts, sg.r * 2, '#000');
  if (L.fade > 0.01) {
    const pts = segs[0].pts, total = pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
    let acc = 0, e = pts[pts.length - 1];
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc >= total * L.fade) { e = pts[i]; break; } }
    const gr = r.createLinearGradient(pts[0].x, pts[0].y, e.x, e.y);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    r.globalCompositeOperation = 'destination-out';
    r.fillStyle = gr; r.fillRect(x0, y0, bw, bh);
  }
  r.globalCompositeOperation = 'source-over';
  g.drawImage(r.canvas, x0, y0, bw, bh, x0, y0, bw, bh);
  // los trozos que pasan por detrás del cuerpo quedan tapados por él (y por su contorno)
  r.clearRect(x0, y0, bw, bh);
  let any = false;
  r.lineCap = 'round';
  for (const sg of segs) {
    for (let i = 1; i < sg.pts.length; i++) {
      const a = clamp((0.03 - (sg.pts[i - 1].rd + sg.pts[i].rd) / 2) / 0.06);
      if (a <= 0.01) continue;
      any = true;
      r.globalAlpha = a; r.lineWidth = (sg.r + OUT * C.S) * 2 + 6; r.strokeStyle = '#000';
      r.beginPath(); r.moveTo(sg.pts[i - 1].x, sg.pts[i - 1].y); r.lineTo(sg.pts[i].x, sg.pts[i].y); r.stroke();
    }
  }
  r.globalAlpha = 1;
  if (any) {
    r.globalCompositeOperation = 'destination-in';
    r.drawImage(layers(W, H)[2].canvas, x0, y0, bw, bh, x0, y0, bw, bh); // máscara del cuerpo (relleno + contorno)
    r.globalCompositeOperation = 'source-over';
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(r.canvas, x0, y0, bw, bh, x0, y0, bw, bh);
    g.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(g.canvas, x0, y0, bw, bh, x0, y0, bw, bh);
}

// ---------------------------------------------------------------- dibujar el personaje
// o = { x, y, S, phi, pal, pose, face, tilt, roll, sq, lift, shadow }
export function drawToon(ctx, o) {
  const pose = o.pose || {};
  const sit = pose.sit || 0;
  const u = frac((pose.walk || 0) / (2 * Math.PI));
  const bob = (0.03 + 0.025 * Math.sin(2 * Math.PI * u) ** 2) * (pose.amp || 0) * (1 - sit);
  const C = { x: o.x, y: o.y, S: o.S, phi: o.phi || 0, tilt: o.tilt || 0, roll: o.roll || 0, sq: o.sq || 0, base: lerp(0.212, 0.03, sit) + bob + (o.lift || 0) };
  const pal = o.pal || PALETTES.yellow;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (o.shadow !== false) {
    const k = 1 / (1 + (o.lift || 0) * 4);
    ctx.fillStyle = `rgba(90,60,50,${0.17 * k})`;
    ctx.beginPath(); ctx.ellipse(o.x + 0.02 * o.S, o.y + 0.01 * o.S, o.S * lerp(0.3, 0.38, sit) * k, o.S * 0.075 * k, 0, 0, Math.PI * 2); ctx.fill();
  }
  const L = limbs(C, pose);
  const scr = L.map((l) => limbScreen(C, l));
  const outline = bodyOutline(C);
  const bodyPath = (c) => smoothPath(c, outline);
  // 1) contorno exterior de toda la figura (cuerpo + extremidades)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  bodyPath(ctx); ctx.lineWidth = OUT * 2 * C.S; ctx.strokeStyle = INK; ctx.stroke();
  for (const segs of scr) for (const sg of segs) strokePoly(ctx, sg.pts, (sg.r + OUT * C.S) * 2, INK);
  // 2) cuerpo, tallo y cara
  fillBody(ctx, C, outline, pal);
  drawStem(ctx, C);
  if (towardCam(C, [0, 0, 1]) > -0.25) drawFace(ctx, C, o.face || {});
  // 3) extremidades, de la más lejana a la más cercana
  // máscara del cuerpo (relleno + contorno) para tapar lo que pasa por detrás
  const m = layers(ctx.canvas.width, ctx.canvas.height)[2];
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, m.canvas.width, m.canvas.height);
  bodyPath(m); m.fillStyle = '#000'; m.fill(); m.lineWidth = OUT * 2 * C.S; m.lineJoin = 'round'; m.strokeStyle = '#000'; m.stroke();
  const order = L.map((l, i) => i).sort((a, b) => L[a].z - L[b].z);
  for (const i of order) drawLimb(ctx, C, L[i], scr[i], pal, bodyPath);
  ctx.restore();
  return P(C, [0, 1.15, cz(1)]);
}
