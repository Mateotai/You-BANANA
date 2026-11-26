// Plátano estilo 3D: réplica de la figura impresa en PLA (7,2 cm de alto, 1 unidad = 1 cm).
// El cuerpo, los brazos y las piernas son UNA sola pieza: se modelan como una función de
// distancia (SDF) con uniones suaves y se convierten en malla con "marching cubes".
// Así no hay bolas en las articulaciones ni cortes entre piezas, igual que la figura real.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';

const W = 1080, H = 1920;
const YELLOW = new THREE.Color('#ffdc00');

// ---------------------------------------------------------------- forma
const HB = 6.2; // alto del cuerpo (sin el tallo)
const RX = 1.76, RZ = 1.0; // radios en la parte ancha: más ancho que profundo, como la figura
const BZ = 0.6; // cuánto se inclina la punta hacia delante
const BACK = 0.25; // el lomo se curva hacia atrás a media altura (forma de plátano)
const FRONT = Math.PI / 2; // +z es la parte de delante (cara, rodillas)

// redondeo de la base (abajo) y del corte del tallo (arriba)
function rounding(t) {
  let r = 1;
  if (t < 0.32) r = Math.pow(Math.max(0, 1 - Math.pow((0.32 - t) / 0.32, 2.0)), 1 / 2.0);
  return r;
}
// estrechamiento hacia la punta (distinto en ancho y en fondo: arriba queda casi cuadrado)
const taper = (t, end) => (t < 0.42 ? 1 : 1 - (1 - end) * Math.pow((t - 0.42) / 0.58, 2.0));
const px = (t) => taper(t, 0.34), pz = (t) => taper(t, 0.56);
// columna; por encima de t=1 se prolonga en línea recta (para el corte inclinado del tallo)
const spineZ = (t) => (t <= 1 ? BZ * Math.pow(t, 2.4) - BACK * Math.sin(Math.PI * t) : BZ * (1 + 2.4 * (t - 1)) + BACK * Math.PI * (t - 1));
const TOP_C = new THREE.Vector3(0, HB, BZ);
const TOP_N = new THREE.Vector3(0, HB, 2.4 * BZ + BACK * Math.PI).normalize(); // perpendicular al corte de arriba
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}
const ridgeAt = (th) => 1 + 0.03 * Math.cos(5 * (th - FRONT - Math.PI / 5));
const flatAt = (th) => 1 - 0.05 * Math.pow(Math.max(0, Math.cos(th - FRONT)), 4);

function bodySD(x, y, z) {
  const t = y / HB;
  const tc = Math.min(1.12, Math.max(0, t));
  const dz = z - spineZ(tc);
  const th = Math.atan2(dz, x);
  const rx = RX * px(tc), rz = RZ * pz(tc) * flatAt(th);
  const ex = x / rx, ez = dz / rz;
  let d = (Math.sqrt(ex * ex + ez * ez) - rounding(tc) * ridgeAt(th)) * Math.min(rx, rz);
  if (t < 0) d = Math.max(d, -y);
  // corte plano, perpendicular a la columna, donde se encaja el tallo
  const plane = (y - TOP_C.y) * TOP_N.y + (z - TOP_C.z) * TOP_N.z;
  return smax(d, plane, 0.22);
}
// punto de la superficie del cuerpo para una altura relativa t y un ángulo th
function bodySurface(t, th) {
  const r = rounding(t) * ridgeAt(th);
  return new THREE.Vector3(Math.cos(th) * RX * px(t) * r, t * HB, spineZ(t) + Math.sin(th) * RZ * pz(t) * flatAt(th) * r);
}

// cono redondeado (Inigo Quilez): cápsula con radios distintos en cada punta
function roundCone(a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const xvx = pax * l2 - bax * yy, xvy = pay * l2 - bay * yy, xvz = paz * l2 - baz * yy;
    const x2 = xvx * xvx + xvy * xvy + xvz * xvz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// extremidades (para cada lado s = -1 / +1)
const LIMBS = [-1, 1].map((s) => {
  const P = (x, y, z) => [s * x, y, z];
  const shoulder = P(1.55, 3.05, 0.1), elbow = P(1.5, 2.32, 0.98), wrist = P(1.05, 1.74, 1.8), hand = P(0.62, 1.47, 2.12);
  const hip = P(0.5, 0.85, 0.45), knee = P(0.5, 2.0, 1.55), ankle = P(0.64, 0.4, 2.15), toe = P(0.7, 0.32, 2.5);
  return {
    shoulder, hip,
    arm: [roundCone(shoulder, elbow, 0.31, 0.275), roundCone(elbow, wrist, 0.27, 0.265), roundCone(wrist, hand, 0.265, 0.27)],
    leg: [roundCone(hip, knee, 0.44, 0.43), roundCone(knee, ankle, 0.4, 0.32), roundCone(ankle, toe, 0.31, 0.3)],
  };
});

function figureSD(x, y, z) {
  let d = bodySD(x, y, z);
  for (const L of LIMBS) {
    // brazo: se funde con el cuerpo sólo en el hombro
    let arm = L.arm[0](x, y, z);
    arm = smin(arm, L.arm[1](x, y, z), 0.04);
    arm = smin(arm, L.arm[2](x, y, z), 0.04);
    const ds = (x - L.shoulder[0]) ** 2 + (y - L.shoulder[1]) ** 2 + (z - L.shoulder[2]) ** 2;
    d = smin(d, arm, 0.035 + 0.22 * Math.exp(-ds / 0.2));
  }
  for (const L of LIMBS) {
    // pierna: muslo y espinilla en un solo tubo (la rodilla es sólo la curva)
    let leg = L.leg[0](x, y, z);
    leg = smin(leg, L.leg[1](x, y, z), 0.06);
    // pie: el mismo tubo, un poco aplanado (no una bola)
    const FY = 1.3;
    leg = smin(leg, L.leg[2](x, 0.3 + (y - 0.3) * FY, z) / FY, 0.12);
    const dh = (x - L.hip[0]) ** 2 + (y - L.hip[1]) ** 2 + (z - L.hip[2]) ** 2;
    d = smin(d, leg, 0.04 + 0.35 * Math.exp(-dh / 0.35));
  }
  return Math.max(d, -y); // base plana apoyada en el suelo
}

// ---------------------------------------------------------------- marching cubes
const EDGES = [
  [0, 1, 0, 0, 0, 0], [1, 2, 1, 1, 0, 0], [2, 3, 0, 0, 1, 0], [3, 0, 1, 0, 0, 0],
  [4, 5, 0, 0, 0, 1], [5, 6, 1, 1, 0, 1], [6, 7, 0, 0, 1, 1], [7, 4, 1, 0, 0, 1],
  [0, 4, 2, 0, 0, 0], [1, 5, 2, 1, 0, 0], [2, 6, 2, 1, 1, 0], [3, 7, 2, 0, 1, 0],
]; // [corner a, corner b, eje, offset x, y, z de la esquina mínima]
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

function polygonize(sdf, min, max, step) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1, ny = Math.ceil((max[1] - min[1]) / step) + 1, nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const field = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    field[i + nx * (j + ny * k)] = sdf(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  const pos = [], idx = [], cache = new Map();
  const vals = new Float32Array(8), eid = new Int32Array(12);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let cube = 0;
    for (let c = 0; c < 8; c++) {
      const o = CORNERS[c];
      vals[c] = field[i + o[0] + nx * (j + o[1] + ny * (k + o[2]))];
      if (vals[c] < 0) cube |= 1 << c;
    }
    const edges = edgeTable[cube];
    if (!edges) continue;
    for (let e = 0; e < 12; e++) {
      if (!(edges & (1 << e))) continue;
      const [ca, cb, axis, ox, oy, oz] = EDGES[e];
      const key = ((i + ox) + nx * ((j + oy) + ny * (k + oz))) * 3 + axis;
      let vi = cache.get(key);
      if (vi === undefined) {
        const va = vals[ca], vb = vals[cb], f = va / (va - vb);
        const A = CORNERS[ca], B = CORNERS[cb];
        pos.push(min[0] + (i + A[0] + (B[0] - A[0]) * f) * step, min[1] + (j + A[1] + (B[1] - A[1]) * f) * step, min[2] + (k + A[2] + (B[2] - A[2]) * f) * step);
        vi = pos.length / 3 - 1;
        cache.set(key, vi);
      }
      eid[e] = vi;
    }
    const base = cube * 16;
    for (let n = 0; triTable[base + n] !== -1; n += 3) idx.push(eid[triTable[base + n]], eid[triTable[base + n + 1]], eid[triTable[base + n + 2]]);
  }
  // normales suaves a partir del gradiente de la SDF
  const nrm = new Float32Array(pos.length), e = 0.01;
  for (let v = 0; v < pos.length; v += 3) {
    const x = pos[v], y = pos[v + 1], z = pos[v + 2];
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[v] = gx / l; nrm[v + 1] = gy / l; nrm[v + 2] = gz / l;
  }
  // orientar los triángulos hacia fuera
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let agree = 0;
  for (let t = 0; t < Math.min(idx.length, 3000); t += 3) {
    a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3); c.fromArray(pos, idx[t + 2] * 3);
    const fn = b.sub(a).cross(c.sub(a));
    agree += Math.sign(fn.x * nrm[idx[t] * 3] + fn.y * nrm[idx[t] * 3 + 1] + fn.z * nrm[idx[t] * 3 + 2]);
  }
  if (agree < 0) for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// material con las líneas de impresión de la PLA (según la altura local de la figura)
function plaMaterial(color, rough = 0.5, lines = 0.06) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, specularIntensity: 0.45 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLayerY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayerY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLayerY;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n float layer = 0.5 + 0.5 * sin(vLayerY * 120.0);\n diffuseColor.rgb *= 1.0 - ${lines.toFixed(3)} * layer;`);
  };
  return m;
}

export async function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.15;

  scene.add(new THREE.HemisphereLight('#fff6e0', '#f5d6c0', 0.9));
  const key = new THREE.DirectionalLight('#fff6e8', 1.95);
  key.position.set(-1, 12, 13); // luz de frente-derecha y desde arriba, como en la foto
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 10; key.shadow.camera.bottom = -6;
  key.shadow.radius = 6; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#fff0e8', 0.9);
  fill.position.set(-12, 4, -1);
  scene.add(fill);

  // peana blanca redonda
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 1.6, 96), new THREE.MeshStandardMaterial({ color: '#f6eee5', roughness: 0.95 }));
  ped.position.y = -0.8;
  ped.receiveShadow = true;
  if (!opts.ref) scene.add(ped);

  // ---------- figura (una sola pieza) ----------
  const fig = new THREE.Group();
  scene.add(fig);
  const bodyMat = plaMaterial(YELLOW, 0.5);
  const body = new THREE.Mesh(polygonize(figureSD, [-2.5, -0.05, -1.6], [2.5, HB + 0.6, 3.4], 0.032), bodyMat);
  body.castShadow = body.receiveShadow = true;
  fig.add(body);

  // tallo marrón encajado en la punta
  const stemGeo = new RoundedBoxGeometry(1.06, 0.74, 1.06, 4, 0.13);
  const topDir = TOP_N.clone();
  const stemPos = TOP_C.clone().addScaledVector(topDir, 0.24);
  const stemRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), topDir).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.55));
  stemGeo.applyMatrix4(new THREE.Matrix4().compose(stemPos, stemRot, new THREE.Vector3(1, 1, 1)));
  const stem = new THREE.Mesh(stemGeo, plaMaterial(new THREE.Color('#7a2e12'), 0.62, 0.12));
  stem.castShadow = stem.receiveShadow = true;
  fig.add(stem);

  // ---------- cara: dos puntos negros y una raya (siempre igual) ----------
  const FACE_T = 0.715; // altura de los ojos (≈4,4 cm)
  const faceMat = new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.4 });
  const frameAt = (t, th) => {
    const e = 1e-3;
    const p = bodySurface(t, th);
    const u = bodySurface(t, th + e).sub(bodySurface(t, th - e)).normalize();
    const v = bodySurface(t + e, th).sub(bodySurface(t - e, th)).normalize();
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    // que la normal apunte hacia fuera del eje
    const axis = new THREE.Vector3(0, p.y, spineZ(t));
    if (n.dot(p.clone().sub(axis)) < 0) n.negate();
    // base ortonormal: u horizontal sobre la superficie, v "hacia arriba"
    const uu = new THREE.Vector3().crossVectors(v, n).normalize();
    const vv = new THREE.Vector3().crossVectors(n, uu).normalize();
    return { p, u: uu, v: vv, n };
  };
  const place = (mesh, t, th, lift) => {
    const f = frameAt(t, th);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.u, f.v, f.n));
    mesh.position.copy(f.p).addScaledVector(f.n, lift);
  };
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 16), faceMat);
    e.userData.s = s;
    fig.add(e);
    return e;
  });
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.74, 8, 16).rotateZ(Math.PI / 2), faceMat);
  mouth.scale.set(1, 1, 0.55);
  fig.add(mouth);

  // gota de sudor
  const dropGeo = new THREE.SphereGeometry(0.2, 24, 16);
  {
    const p = dropGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) { const k = 1 - y / 0.2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * 2.2); }
    }
    dropGeo.computeVertexNormals();
  }
  const sweat = new THREE.Mesh(dropGeo, new THREE.MeshPhysicalMaterial({ color: '#8fd8ff', roughness: 0.05, transparent: true, opacity: 0.92, clearcoat: 1 }));
  fig.add(sweat);

  // ---------- cámara (misma vista 3/4 que la foto de producto) ----------
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 200);
  const AZ = -0.8, EL = 0.24, D0 = 34;
  const camDir = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
  const baseTarget = new THREE.Vector3(0.2, 3.4, 0.6);
  const OFFSET0 = -400;
  const OFFSET_ZOOM = -40;

  function layoutFace(s) {
    const th = FRONT - s.lookX * 0.05;
    const tt = FACE_T - s.lookY * 0.012;
    const sep = 0.33; // ≈0,72 cm entre ojos
    for (const e of eyes) {
      place(e, tt, th - e.userData.s * sep, 0.0);
      e.scale.set(1, 1 - s.blink * 0.85, 0.5);
    }
    place(mouth, tt - 0.052, th, 0.0);
  }

  return {
    render(s) {
      // pose: balanceo, respiración, girarse hacia cámara, echarse atrás al mirar arriba
      fig.rotation.set(s.rock * 0.8 - s.lean * 0.05, AZ * 0.9 * s.turn, s.rock * 0.35, 'YXZ');
      fig.scale.set(1 - s.breath * 0.5, 1 + s.breath, 1 - s.breath * 0.5);
      layoutFace(s);

      sweat.visible = s.sweat >= 0;
      if (sweat.visible) {
        const f = frameAt(0.8 - s.sweat * 0.2, FRONT + 0.75);
        sweat.quaternion.identity();
        sweat.position.copy(f.p).addScaledVector(f.n, 0.12);
      }

      fig.updateMatrixWorld(true);
      const faceWorld = bodySurface(FACE_T - 0.025, FRONT).applyMatrix4(fig.matrixWorld);
      const f = s.zoomFocus;
      const target = baseTarget.clone().lerp(faceWorld, f);
      camera.position.copy(target).addScaledVector(camDir, D0 / Math.pow(s.zoom, 0.88));
      camera.lookAt(target);
      if (opts.ref) {
        // encuadre de comparación: figura centrada y grande
        camera.position.copy(new THREE.Vector3(0.3, 3.5, 0.7)).addScaledVector(camDir, 26);
        camera.lookAt(0.3, 3.5, 0.7);
        camera.clearViewOffset();
      } else camera.setViewOffset(W, H, -s.shake.x, OFFSET0 + (OFFSET_ZOOM - OFFSET0) * f - s.shake.y, W, H);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
  };
}

// piezas que reutiliza el programa 3D (src/show3d.js)
export { HB, FRONT, TOP_C, TOP_N, bodySD, bodySurface, polygonize, plaMaterial };
