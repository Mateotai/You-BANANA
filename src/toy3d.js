// Plátano 3D (estilo juguete de vinilo) según la hoja de personaje 3D (assets/sheet/poses-3d.png).
// Unidades: alto del cuerpo (base -> arranque del tallo) = 1. Medidas tomadas de la hoja.
// El personaje se puede animar con los mismos parámetros que la versión 2D:
//   phi (giro), pose { walk, amp, sit, slump, hug, call, callSide, beck }, face { lookX, lookY, frown, blink },
//   tilt (inclinación), sq (aplastar/estirar).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const L3 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const frac = (x) => x - Math.floor(x);

// ---------------------------------------------------------------- medidas (hoja 3D)
export const DIM = {
  base: 0.183, // altura de la base del cuerpo sobre el suelo, de pie (largo visible de las piernas)
  legR: 0.08, footR: 0.062, legX: 0.091,
  armR: 0.056,
  eyeT: 0.712, eyeX: 0.077, eyeR: 0.027,
  mouthT: 0.641, mouthHalf: 0.076, mouthR: 0.0158,
  stem: [0.19, 0.21, 0.19], stemSink: 0.015, stemFwd: 0.015, stemR: 0.03,
};
// semiancho de frente (x) y semifondo (z) del cuerpo según la altura t (0 = abajo, 1 = arriba)
const HW = [[-0.04, 0.0], [-0.035, 0.06], [-0.02, 0.11], [0.0, 0.152], [0.046, 0.192], [0.097, 0.222], [0.148, 0.243], [0.21, 0.262], [0.3, 0.274], [0.4, 0.274],
  [0.502, 0.268], [0.553, 0.259], [0.603, 0.251], [0.654, 0.243], [0.705, 0.23], [0.755, 0.217], [0.806, 0.2], [0.857, 0.181], [0.907, 0.16], [0.958, 0.126], [0.985, 0.112], [1.0, 0.104], [1.03, 0.088], [1.06, 0.072]];
const HD = [[-0.04, 0.0], [-0.035, 0.05], [-0.02, 0.088], [0.0, 0.122], [0.042, 0.152], [0.093, 0.198], [0.143, 0.226], [0.194, 0.24], [0.245, 0.249], [0.295, 0.255],
  [0.346, 0.257], [0.397, 0.255], [0.447, 0.253], [0.498, 0.249], [0.549, 0.243], [0.599, 0.234], [0.65, 0.228], [0.7, 0.216], [0.751, 0.205], [0.802, 0.192],
  [0.852, 0.176], [0.903, 0.156], [0.954, 0.122], [0.985, 0.104], [1.0, 0.095], [1.03, 0.077], [1.06, 0.059]];
const CZ = [[-0.04, 0.0], [0.45, 0.0], [0.6, 0.008], [0.7, 0.02], [0.8, 0.037], [0.9, 0.057], [0.954, 0.068], [1.0, 0.08], [1.03, 0.088], [1.06, 0.096]];
// interpolación cúbica monótona (Fritsch-Carlson): curva suave sin escalones en el sombreado
const SPL = new Map();
function spline(T) {
  if (SPL.has(T)) return SPL.get(T);
  const n = T.length, x = T.map((p) => p[0]), y = T.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  const S = { x, y, m };
  SPL.set(T, S);
  return S;
}
function interp(T, t) {
  const { x, y, m } = spline(T);
  if (t <= x[0]) return y[0];
  if (t >= x[x.length - 1]) return y[y.length - 1];
  let i = 0;
  while (t > x[i + 1]) i++;
  const h = x[i + 1] - x[i], u = (t - x[i]) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
}
// la base es redonda: la curva baja se cierra como media esfera aplastada
const T0 = -0.04;
function smoothTable(T, sigma = 0.035) {
  const N = 600, t0 = T[0][0], t1 = T[T.length - 1][0], xs = [], ys = [];
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; xs.push(t); ys.push(interp(T, t)); }
  const out = ys.map((_, i) => {
    let sw = 0, sv = 0;
    for (let j = Math.max(0, i - 60); j <= Math.min(N, i + 60); j++) { const w = Math.exp(-0.5 * ((xs[j] - xs[i]) / sigma) ** 2); sw += w; sv += w * ys[j]; }
    // en la base (que se cierra en un punto) no suavizamos para no cambiar el redondeo
    return xs[i] < 0.02 ? ys[i] : sv / sw;
  });
  return (t) => { const f = ((t - t0) / (t1 - t0)) * N; if (f <= 0) return out[0]; if (f >= N) return out[N]; const i = Math.floor(f); return lerp(out[i], out[i + 1], f - i); };
}
export const hw = smoothTable(HW);
export const hd = smoothTable(HD);
export const cz = smoothTable(CZ, 0.05);

// punto de la superficie del cuerpo (sin deformar): t altura, a ángulo (0 = delante)
// cerca de la punta, las secciones se inclinan hacia delante: la tapa de arriba queda más alta
// por detrás que por delante (como en el perfil de la hoja) y el tallo se apoya en ella
export const TOP_TILT = 0.33;
const s01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const topTilt = (t) => TOP_TILT * s01((t - 0.8) / 0.2);
export function surf(t, a, k = 1) {
  const ox = hw(t) * Math.sin(a) * k, oz = hd(t) * Math.cos(a) * k, th = topTilt(t);
  return [ox, t - oz * Math.sin(th), cz(t) + oz * Math.cos(th)];
}
export const CAP_C = [0, 1.0, 0]; // centro de la tapa (z se completa abajo)
export const CAP_AX = [0, Math.cos(TOP_TILT), Math.sin(TOP_TILT)]; // eje del tallo

// ---------------------------------------------------------------- materiales
export const PALETTE3D = {
  yellow: '#fdd307', green: '#9fd35a', pink: '#ff9fc6', blue: '#7cc8ff', purple: '#b89bff',
};
function vinyl(color) {
  // vinilo mate: poco brillo para que el color quede saturado como en la hoja
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.68, metalness: 0, specularIntensity: 0.28 });
}

// ---------------------------------------------------------------- geometrías
const NT = 110, NA = 72;
function bodyGeometry() {
  const pos = [], idx = [];
  // anillos de abajo (polo) a arriba; arriba se cierra con una tapa plana (la tapa el tallo)
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(T0 + (1.0 - T0) * (i / NT));
  for (const t of ts) for (let j = 0; j < NA; j++) { const a = (j / NA) * Math.PI * 2; pos.push(...surf(t, a)); }
  // tapa de arriba (inclinada) con el canto redondeado; el tallo se apoya encima
  const R0 = 0.02;
  const PH = [0.4, 0.8, 1.2, 1.5];
  for (const ph of PH) {
    const k = 1 - (R0 / 0.1) * (1 - Math.cos(ph)), h = R0 * Math.sin(ph);
    for (let j = 0; j < NA; j++) { const a = (j / NA) * Math.PI * 2; const p = surf(1.0, a, k); pos.push(p[0] + CAP_AX[0] * h, p[1] + CAP_AX[1] * h, p[2] + CAP_AX[2] * h); }
  }
  const rings = NT + 1 + PH.length;
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < NA; j++) {
    const a = i * NA + j, b = i * NA + ((j + 1) % NA), c = (i + 1) * NA + j, d = (i + 1) * NA + ((j + 1) % NA);
    idx.push(a, b, c, b, d, c);
  }
  const top = pos.length / 3; pos.push(CAP_AX[0] * R0, 1.0 + CAP_AX[1] * R0, cz(1.0) + CAP_AX[2] * R0);
  for (let j = 0; j < NA; j++) idx.push((rings - 1) * NA + j, (rings - 1) * NA + ((j + 1) % NA), top);
  // polo de abajo
  const bot = pos.length / 3; pos.push(0, T0 - 0.002, 0);
  for (let j = 0; j < NA; j++) idx.push(((j + 1) % NA), j, bot);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const BODY_BASE = bodyGeometry();

// tubo de radio variable con las puntas redondeadas (cápsula curva)
function tube(points, radii, seg = 40, radial = 18) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const N = seg, frames = curve.computeFrenetFrames(N, false);
  const pos = [], idx = [];
  const rAt = (u) => { const f = u * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)); const k = f - i; return lerp(radii[i], radii[i + 1], k * k * (3 - 2 * k)); };
  const ring = (c, n, b, r) => { for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2; const v = n.clone().multiplyScalar(Math.cos(a)).add(b.clone().multiplyScalar(Math.sin(a))); pos.push(c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); } };
  // casquete inicial
  const capRings = 7;
  const P0 = curve.getPointAt(0), T0v = curve.getTangentAt(0), r0 = rAt(0);
  for (let k = 0; k < capRings; k++) {
    const th = (Math.PI / 2) * (k / capRings);
    ring(P0.clone().addScaledVector(T0v, -Math.cos(th) * r0), frames.normals[0], frames.binormals[0], Math.sin(th) * r0 + 1e-4);
  }
  for (let i = 0; i <= N; i++) { const u = i / N; ring(curve.getPointAt(u), frames.normals[i], frames.binormals[i], rAt(u)); }
  const P1 = curve.getPointAt(1), T1v = curve.getTangentAt(1), r1 = rAt(1);
  for (let k = 1; k <= capRings; k++) {
    const th = (Math.PI / 2) * (1 - k / capRings);
    ring(P1.clone().addScaledVector(T1v, Math.cos(th) * r1), frames.normals[N], frames.binormals[N], Math.sin(th) * r1 + 1e-4);
  }
  const rings = pos.length / 3 / radial;
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- pose (mismos números que la versión 2D)
const STRIDE = 0.27;
const FOOT = [0.168, 0.105, 0.235]; // ancho, alto y largo del pie (hoja 3D)
function ik2(root, end, a, b, bend) {
  const dy = end[1] - root[1], dz = end[2] - root[2];
  const d = Math.hypot(dy, dz) || 1e-6, dd = Math.min(d, a + b - 1e-4);
  const al = (a * a - b * b + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, a * a - al * al));
  const uy = dy / d, uz = dz / d;
  return [lerp(root[0], end[0], al / dd), root[1] + uy * al + uz * h * bend, root[2] + uz * al - uy * h * bend];
}
function rotX(v, t) { const c = Math.cos(t), s = Math.sin(t); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }

// devuelve puntos de control (coordenadas del cuerpo: y desde la base del cuerpo) de piernas y brazos
export function rig(pose, base) {
  const sit = pose.sit || 0, amp = (pose.amp || 0) * (1 - sit), ph = pose.walk || 0;
  const gnd = -base;
  const out = { legs: [], arms: [] }, legZ = {};
  for (const s of [-1, 1]) {
    const u = frac(ph / (2 * Math.PI) + (s < 0 ? 0 : 0.5));
    let z, lift, pitch;
    if (u < 0.5) { z = lerp(STRIDE, -STRIDE, u / 0.5); lift = 0; pitch = 0; } else { const k = (u - 0.5) / 0.5, e = k * k * (3 - 2 * k); z = lerp(-STRIDE, STRIDE, e); lift = 0.09 * Math.sin(Math.PI * k); pitch = 0.6 * Math.sin(Math.PI * k); }
    z *= amp; lift *= amp; pitch *= amp;
    legZ[s] = z;
    const r = DIM.legR;
    const hip = [s * DIM.legX, 0.07, 0.01];
    const ank = [s * DIM.legX, gnd + r + lift, 0.02 + z];
    const d = Math.hypot(ank[1] - hip[1], ank[2] - hip[2]);
    const len = 0.07 + DIM.base - r + 0.002; // de pie la pierna queda recta
    const bend = Math.sqrt(Math.max(0, (len / 2) ** 2 - (d / 2) ** 2)) * 1.3;
    const knee = [s * DIM.legX, (hip[1] + ank[1]) / 2, (hip[2] + ank[2]) / 2 + bend];
    const sitK = clamp(sit * 1.25);
    const hipS = [s * 0.1, 0.12, 0.06], kneeS = [s * 0.115, 0.37, 0.42], ankS = [s * 0.12, gnd + r, 0.5];
    const H = L3(hip, hipS, sit), K = L3(knee, kneeS, sitK), A = L3(ank, ankS, sit);
    out.legs.push({ s, pts: [H, K, A], foot: { pos: [A[0], A[1] - r + FOOT[1] / 2, A[2] + 0.035], pitch } });
  }
  for (const s of [-1, 1]) {
    const sh = [s * 0.19, 0.5, -0.02];
    let el = [s * 0.27, 0.34, 0.05], ha = [s * 0.255, 0.165, 0.14];
    const th = 1.1 * (legZ[s] / STRIDE);
    if (th) { el = add(sh, rotX([el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]], th)); ha = add(sh, rotX([ha[0] - sh[0], ha[1] - sh[1], ha[2] - sh[2]], th)); }
    const sitK = clamp(sit * 1.15 - 0.15);
    el = L3(el, [s * 0.27, 0.36, 0.2], sitK); ha = L3(ha, [s * 0.12, 0.49, 0.43], sitK); // las manos descansan sobre las rodillas
    if (pose.slump) { el = L3(el, [s * 0.25, 0.33, 0.17], pose.slump); ha = L3(ha, [s * 0.15, 0.17, 0.28], pose.slump); }
    if (pose.hug) { el = L3(el, [s * 0.27, 0.4, 0.4], pose.hug); ha = L3(ha, [-s * 0.035, 0.37, 0.57], pose.hug); }
    if (pose.call && s === (pose.callSide || 1)) {
      const b = 0.5 + 0.5 * Math.sin(pose.beck || 0);
      el = L3(el, [s * 0.36, 0.52, 0.22], pose.call);
      ha = L3(ha, [s * 0.46, 0.58 + 0.09 * b, 0.52 - 0.08 * b], pose.call);
    }
    out.arms.push({ s, pts: [sh, el, ha] });
  }
  return out;
}

// ---------------------------------------------------------------- personaje
export class Banana3D {
  constructor(color = PALETTE3D.yellow) {
    this.root = new THREE.Group(); // en el suelo, gira con phi
    this.body = new THREE.Group(); // base del cuerpo
    this.root.add(this.body);
    this.mat = vinyl(color);
    this.stemMat = new THREE.MeshPhysicalMaterial({ color: '#743a13', roughness: 0.72, specularIntensity: 0.3 });
    this.inkMat = new THREE.MeshPhysicalMaterial({ color: '#141210', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    this.bodyGeo = BODY_BASE.clone();
    this.bodyMesh = new THREE.Mesh(this.bodyGeo, this.mat);
    this.stem = new THREE.Mesh(new RoundedBoxGeometry(...DIM.stem, 5, DIM.stemR), this.stemMat);
    this.limbs = [0, 1, 2, 3].map(() => new THREE.Mesh(new THREE.BufferGeometry(), this.mat));
    this.feet = [0, 1].map(() => new THREE.Mesh(new RoundedBoxGeometry(...FOOT, 6, 0.05), this.mat));
    this.eyes = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), this.inkMat));
    this.mouth = new THREE.Mesh(new THREE.BufferGeometry(), this.inkMat);
    for (const m of [this.bodyMesh, this.stem, ...this.limbs, ...this.feet, ...this.eyes, this.mouth]) { m.castShadow = true; m.receiveShadow = false; this.body.add(m); }
  }
  setColor(c) { this.mat.color.set(c); }

  // deformación del cuerpo: aplastar/estirar y doblar hacia delante (cabizbajo)
  deform(p, bend, sq) {
    let [x, y, z] = p;
    const k = clamp(y / 0.25);
    y *= 1 + sq; x *= 1 - sq * 0.5 * k; z *= 1 - sq * 0.5 * k;
    if (bend) {
      // se dobla más arriba (como un plátano): ángulo creciente con la altura
      const a = bend * clamp(y, 0, 1.2) ** 1.4;
      const c = Math.cos(a), s = Math.sin(a);
      [y, z] = [y * c - z * s, y * s + z * c];
    }
    return [x, y, z];
  }

  update(st) {
    const pose = st.pose || {}, face = st.face || {};
    const sit = pose.sit || 0;
    const u = frac((pose.walk || 0) / (2 * Math.PI));
    const bob = (0.03 + 0.025 * Math.sin(2 * Math.PI * u) ** 2) * (pose.amp || 0) * (1 - sit);
    const base = lerp(DIM.base, 0.03, sit) + bob;
    const bend = (st.tilt || 0) * 1.6;
    const sq = st.sq || 0;
    this.root.rotation.y = st.phi || 0;
    this.body.position.y = base;
    // cuerpo deformado
    const P = this.bodyGeo.attributes.position, B = BODY_BASE.attributes.position;
    for (let i = 0; i < P.count; i++) { const q = this.deform([B.getX(i), B.getY(i), B.getZ(i)], bend, sq); P.setXYZ(i, q[0], q[1], q[2]); }
    P.needsUpdate = true;
    this.bodyGeo.computeVertexNormals();
    // marco local de la superficie deformada (para pegar cara, tallo y extremidades)
    const D = (p) => this.deform(p, bend, sq);
    // tallo: sobre la punta, siguiendo la inclinación
    // tallo: apoyado en la tapa de arriba, un poco hundido y adelantado: por delante tapa el
    // borde de la tapa (unión recta, como en la hoja) y a los lados y detrás asoma el cuello
    const c0 = [0, 1.0, cz(1.0) + DIM.stemFwd];
    const tA = D(c0), tB = D(c0.map((v, i) => v + CAP_AX[i] * 0.06));
    const dir = new THREE.Vector3(tB[0] - tA[0], tB[1] - tA[1], tB[2] - tA[2]).normalize();
    this.stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.stem.position.set(tA[0], tA[1], tA[2]).addScaledVector(dir, DIM.stem[1] / 2 - DIM.stemSink);
    // extremidades
    const R = rig(pose, base);
    const dl = (p) => (p[1] > 0.02 ? D(p) : p);
    R.legs.forEach((L, i) => {
      this.limbs[i].geometry.dispose();
      this.limbs[i].geometry = tube(L.pts.map(dl), [DIM.legR, DIM.legR, DIM.legR]);
      const f = this.feet[i];
      f.position.set(...L.foot.pos);
      f.rotation.set(-L.foot.pitch, 0, 0);
    });
    R.arms.forEach((A, i) => { this.limbs[2 + i].geometry.dispose(); this.limbs[2 + i].geometry = tube(A.pts.map(D), [DIM.armR * 0.95, DIM.armR, DIM.armR * 1.06]); });
    // cara
    const look = [(face.lookX || 0) * 0.18, (face.lookY || 0) * -0.03];
    const onSurf = (t, a, lift = 0) => {
      const p = surf(t, a), e = 0.002;
      const n = new THREE.Vector3(...surf(t, a + e)).sub(new THREE.Vector3(...surf(t, a - e)))
        .cross(new THREE.Vector3(...surf(t + e, a)).sub(new THREE.Vector3(...surf(t - e, a)))).normalize();
      if (n.z < 0) n.negate();
      const q = D([p[0] + n.x * lift, p[1] + n.y * lift, p[2] + n.z * lift]);
      return new THREE.Vector3(...q);
    };
    const eyeA = DIM.eyeX / hw(DIM.eyeT);
    this.eyes.forEach((e, i) => {
      const s = i ? 1 : -1;
      e.position.copy(onSurf(DIM.eyeT + look[1], s * eyeA + look[0], -DIM.eyeR * 0.15));
      e.scale.set(DIM.eyeR, DIM.eyeR * Math.max(0.12, 1 - (face.blink || 0) * 0.9), DIM.eyeR * 0.85);
    });
    const fr = face.frown || 0, pts = [];
    const mA = DIM.mouthHalf / hw(DIM.mouthT) * (1 - 0.12 * fr);
    for (let i = 0; i <= 12; i++) {
      const v = -1 + (2 * i) / 12;
      const dt = fr * (0.022 * (1 - v * v) - 0.006);
      pts.push(onSurf(DIM.mouthT + look[1] + dt, v * mA + look[0], DIM.mouthR * 0.35));
    }
    this.mouth.geometry.dispose();
    this.mouth.geometry = tube(pts.map((p) => [p.x, p.y, p.z]), [DIM.mouthR, DIM.mouthR], 30, 10);
  }
}
