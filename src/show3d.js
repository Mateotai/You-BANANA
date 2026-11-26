// Formato "de pie" en 3D, con pandilla de plátanos.
// El plátano amarillo mira a un lado, se gira y el viral sale a pantalla completa.
// Al acabar cada video: todos ponen la boca en U invertida a la vez; el amarillo llama
// a otro plátano (de otro color) que llega andando a ver el siguiente video, se giran todos
// al otro lado y entra el siguiente. Así la pandilla crece en cada video.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HB, FRONT, TOP_C, TOP_N, bodySD, bodySurface, polygonize, plaMaterial } from './banana3d.js';

export const W = 1080, H = 1920, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (t0, t1, t) => { const x = clamp((t - t0) / (t1 - t0)); return x * x * (3 - 2 * x); };
const pulse = (t0, d, t) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : 1 - Math.abs(x * 2 - 1); };

export const COLORS = ['#ffdc00', '#ff7eb6', '#4fc3ff', '#5cc85a', '#a77bff', '#ff9a2e', '#ff5a5a'];
const SIDE_YAW = 0.85; // cuánto se giran para "mirar a un lado"

// ---------------------------------------------------------------- guion
export function buildShow(cfg) {
  const items = cfg.items;
  const sh = { items, plays: [], reacts: [], turns: [], calls: [], cues: [], dirs: [] };
  let t = 1.3; // intro: el amarillo mirando a la izquierda
  let dir = -1;
  sh.slots = [[0, 0]]; // sitio de cada plátano en el suelo (x, z)
  items.forEach((it, i) => {
    sh.turns.push({ a: t, b: t + 0.4, from: dir, to: -dir });
    dir = -dir;
    sh.dirs.push(dir);
    t += 0.5;
    sh.cues.push({ t: t - 0.06, type: 'whoosh', gain: 0.7 });
    sh.plays.push([t, t + it.len]);
    t += it.len;
    sh.reacts.push([t, t + 1.15]);
    sh.cues.push({ t: t + 0.06, type: 'womp', gain: 0.75 + 0.05 * Math.min(4, i) });
    if (i < items.length - 1) {
      // llama a otro plátano, que entra por el lado al que se van a girar
      const side = -dir;
      const k = i + 1;
      const prevSameSide = sh.slots.filter(([x]) => Math.sign(x) === side).length;
      const target = [side * (3.4 * (prevSameSide + 1)), -1.3 * (prevSameSide + 1)];
      sh.slots.push(target);
      const c = { k, side, wave: [t + 1.0, t + 2.9], bubble: [t + 1.3, t + 2.7], walk: [t + 1.6, t + 3.4], target };
      sh.calls.push(c);
      sh.cues.push({ t: t + 1.3, type: 'whistle', gain: 0.8 }, { t: t + 1.3, type: 'pop', gain: 0.5 });
      for (let s = c.walk[0] + 0.12; s < c.walk[1]; s += 0.25) sh.cues.push({ t: s, type: 'step', gain: 0.5 });
      t += 3.6;
    } else t += 1.15 + 0.5;
  });
  sh.duration = t;
  sh.count = items.length; // un plátano por video
  return sh;
}

export function stateAt(sh, t) {
  const s = { t, playing: -1 };
  sh.plays.forEach(([a, b], i) => { if (t >= a && t < b) { s.playing = i; s.videoTime = t - a; } });

  let frown = 0, blinkR = 0;
  for (const [a, b] of sh.reacts) {
    frown = Math.max(frown, smooth(a, a + 0.15, t) * (1 - smooth(b - 0.15, b + 0.1, t)));
    blinkR = Math.max(blinkR, pulse(a + 0.55, 0.4, t));
  }
  s.bubble = null;

  // hacia dónde mira cada plátano (yaw): los giros son de todo el grupo a la vez
  const preTurn = (k, j) => {
    if (j === 0) return -SIDE_YAW;
    const c = sh.calls[j - 1];
    if (k === 0) return c.side * 0.55; // el que llama
    if (k === c.k) return -c.side * 0.5; // el que acaba de llegar mira al grupo
    return c.side * 0.7; // los demás miran al que llega
  };
  const yawOf = (k) => {
    let j = -1;
    sh.turns.forEach((tr, i) => { if (t >= tr.a) j = i; });
    if (j < 0) return -SIDE_YAW;
    const tr = sh.turns[j];
    if (t < tr.b) return lerp(preTurn(k, j), tr.to * SIDE_YAW, smooth(tr.a, tr.b, t));
    let y = tr.to * SIDE_YAW;
    const c = sh.calls[j];
    if (c && k < c.k) y = lerp(y, preTurn(k, j + 1), smooth(c.wave[0] - 0.3, c.wave[0], t));
    return y;
  };

  s.bananas = [];
  for (let k = 0; k < sh.count; k++) {
    const call = sh.calls.find((c) => c.k === k);
    const bn = { k, color: COLORS[k % COLORS.length], visible: true, x: sh.slots[k][0], z: sh.slots[k][1], yaw: yawOf(k), phase: 0, amp: 0, wave: 0, waveSide: 1, frown, roll: -0.05 * frown };
    let blink = blinkR;
    for (let bt = 0.8 + k * 0.37; bt < sh.duration; bt += 2.9) blink = Math.max(blink, pulse(bt, 0.16, t));
    bn.blink = blink;
    if (call && t < sh.turns[k].a) {
      if (t < call.walk[0]) bn.visible = false;
      else if (t < call.walk[1]) {
        // llega andando desde fuera del plano
        const k2 = (t - call.walk[0]) / (call.walk[1] - call.walk[0]);
        bn.x = lerp(call.side * 9.5, call.target[0], k2);
        bn.z = lerp(call.target[1] + 0.6, call.target[1], k2);
        bn.yaw = -call.side * Math.PI / 2;
        bn.phase = (t - call.walk[0]) * Math.PI * 2 / 0.5;
        bn.amp = 1 - smooth(0.85, 1, k2);
        bn.frown = 0; bn.roll = 0;
      } else {
        bn.yaw = lerp(-call.side * Math.PI / 2, preTurn(k, k), smooth(call.walk[1], call.walk[1] + 0.3, t));
        bn.frown = 0; bn.roll = 0;
      }
    }
    s.bananas.push(bn);
  }
  // el amarillo llama saludando con la mano
  const host = s.bananas[0];
  for (const c of sh.calls) {
    if (t >= c.wave[0] && t < c.wave[1]) {
      host.wave = smooth(c.wave[0], c.wave[0] + 0.25, t) * (1 - smooth(c.wave[1] - 0.25, c.wave[1], t));
      host.waveSide = c.side;
    }
    if (t >= c.bubble[0] && t < c.bubble[1]) s.bubble = { text: '¡Ven!', k: Math.min(1, (t - c.bubble[0]) / 0.18), side: c.side };
  }

  // cámara: abarca a todos los que están (o están llegando)
  const xs = s.bananas.filter((b) => b.visible).map((b) => clamp(b.x, -8, 8));
  let target = sh.slots.slice(0, 1).map((p) => p[0]);
  for (const c of sh.calls) if (t >= c.walk[0]) target.push(c.target[0]);
  void xs;
  const minX = Math.min(...target), maxX = Math.max(...target);
  s.cam = { cx: (minX + maxX) / 2, hw: (maxX - minX) / 2 + 2.7 };
  // transición suave de la cámara mientras llega el nuevo
  for (const c of sh.calls) {
    if (t >= c.walk[0] && t < c.walk[1]) {
      const k = smooth(c.walk[0], c.walk[1] - 0.3, t);
      const prev = target.slice(0, -1);
      const pmin = Math.min(...prev), pmax = Math.max(...prev);
      s.cam.cx = lerp((pmin + pmax) / 2, s.cam.cx, k);
      s.cam.hw = lerp((pmax - pmin) / 2 + 2.7, s.cam.hw, k);
    }
  }
  return s;
}

// ---------------------------------------------------------------- personajes 3D
function ik(root, end, a, b, bend) {
  const D = end.clone().sub(root);
  let d = D.length();
  const dir = D.clone().normalize();
  d = Math.min(d, a + b - 1e-3);
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const perp = bend.clone().sub(dir.clone().multiplyScalar(bend.dot(dir))).normalize();
  return root.clone().addScaledVector(dir, along).addScaledVector(perp, h);
}

// tubo de radio variable; rFn(u) con u = 0 (raíz, metida en el cuerpo) .. 1 (punta)
function tubeGeo(points, rFn, seg = 44, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const c = curve.getPointAt(u);
    const r = rFn(u);
    for (let j = 0; j <= radial; j++) {
      const id = i * (radial + 1) + j;
      p.setXYZ(id, c.x + (p.getX(id) - c.x) * r, c.y + (p.getY(id) - c.y) * r, c.z + (p.getZ(id) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return { g, end: curve.getPointAt(1), r: rFn(1) };
}
const flare = (u) => 1 + 0.35 * Math.max(0, 1 - u / 0.1) ** 2; // la raíz se ensancha y se funde con el cuerpo
const legR = (u) => (u < 0.78 ? lerp(0.36, 0.28, u / 0.78) : lerp(0.28, 0.31, (u - 0.78) / 0.22)) * flare(u);
const armR = (u) => (u < 0.85 ? lerp(0.28, 0.24, u / 0.85) : lerp(0.24, 0.265, (u - 0.85) / 0.15)) * flare(u);

const G = 2.55; // altura de la base del cuerpo sobre el suelo (largo de las piernas)

export async function createShow3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6d6c6');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.15;
  scene.add(new THREE.HemisphereLight('#fff6e0', '#f5d6c0', 0.9));
  const key = new THREE.DirectionalLight('#fff6e8', 1.95);
  key.position.set(6, 16, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -6, near: 1, far: 60 });
  key.shadow.radius = 6; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#fff0e8', 0.8);
  fill.position.set(-12, 5, 4);
  scene.add(fill);

  // salón sencillo: suelo y pared en tonos pastel
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#e7bf99', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), new THREE.MeshStandardMaterial({ color: '#f8d9c9', roughness: 1 }));
  wall.position.set(0, 40, -9); wall.receiveShadow = true; scene.add(wall);
  const board = new THREE.Mesh(new THREE.BoxGeometry(200, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: '#fbe9e0', roughness: 1 }));
  board.position.set(0, 0.3, -8.85); scene.add(board);
  for (const [x, y, r, c] of [[-9, 16, 3.2, '#ffffff'], [10, 21, 4.2, '#ffc4c9'], [-2, 26, 2.4, '#ffe3a8']]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45 }));
    m.position.set(x, y, -8.95); scene.add(m);
  }

  // geometrías compartidas
  const bodyGeo = polygonize(bodySD, [-2.05, -0.1, -1.5], [2.05, HB + 0.6, 2.1], 0.034);
  const stemGeo = new RoundedBoxGeometry(1.06, 0.74, 1.06, 4, 0.13);
  const stemPos = TOP_C.clone().addScaledVector(TOP_N, 0.24);
  const stemRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), TOP_N).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.55));
  stemGeo.applyMatrix4(new THREE.Matrix4().compose(stemPos, stemRot, new THREE.Vector3(1, 1, 1)));
  const stemMat = plaMaterial(new THREE.Color('#7a2e12'), 0.62, 0.12);
  const faceMat = new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.4 });
  const sphere = new THREE.SphereGeometry(1, 24, 16);

  // cara sobre la superficie del cuerpo
  const FACE_T = 0.715;
  const frameAt = (t, th) => {
    const e = 1e-3;
    const p = bodySurface(t, th);
    const u = bodySurface(t, th + e).sub(bodySurface(t, th - e)).normalize();
    const v = bodySurface(t + e, th).sub(bodySurface(t - e, th)).normalize();
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    if (n.z < 0) n.negate();
    const uu = new THREE.Vector3().crossVectors(v, n).normalize();
    const vv = new THREE.Vector3().crossVectors(n, uu).normalize();
    return { p, u: uu, v: vv, n };
  };

  function makeBanana(color) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = G;
    root.add(body);
    const mat = plaMaterial(new THREE.Color(color), 0.5);
    const bm = new THREE.Mesh(bodyGeo, mat);
    bm.castShadow = bm.receiveShadow = true;
    body.add(bm);
    const st = new THREE.Mesh(stemGeo, stemMat);
    st.castShadow = true;
    body.add(st);
    const eyes = [-1, 1].map((s) => {
      const e = new THREE.Mesh(sphere, faceMat);
      const f = frameAt(FACE_T, FRONT - s * 0.33);
      e.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.u, f.v, f.n));
      e.position.copy(f.p);
      body.add(e);
      return e;
    });
    const mouth = new THREE.Mesh(new THREE.BufferGeometry(), faceMat);
    body.add(mouth);
    const limbs = {}, caps = {};
    for (const k of ['armL', 'armR', 'legL', 'legR']) {
      limbs[k] = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      limbs[k].castShadow = limbs[k].receiveShadow = true;
      caps[k] = new THREE.Mesh(sphere, mat);
      caps[k].castShadow = true;
      body.add(limbs[k], caps[k]);
    }
    scene.add(root);
    return { root, body, mat, eyes, mouth, limbs, caps };
  }

  function setLimb(B, key, pts, rFn) {
    const { g, end, r } = tubeGeo(pts, rFn);
    B.limbs[key].geometry.dispose();
    B.limbs[key].geometry = g;
    B.caps[key].position.copy(end);
    B.caps[key].scale.setScalar(r);
  }

  function setMouth(B, frown) {
    const pts = [];
    const tm = FACE_T - 0.052;
    for (let i = 0; i <= 14; i++) {
      const x = -0.38 + (0.76 * i) / 14;
      const y = frown * (0.17 * (1 - (x / 0.38) ** 2) - 0.06);
      const f = frameAt(tm + y / HB, FRONT - x / 0.95);
      pts.push(f.p.clone().addScaledVector(f.n, 0.025));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.066, 10, false);
    B.mouth.geometry.dispose();
    B.mouth.geometry = g;
  }

  function poseBanana(B, st, t) {
    B.root.visible = st.visible;
    if (!st.visible) return;
    B.root.position.set(st.x, 0, st.z);
    B.root.rotation.set(0, st.yaw, 0);
    const bob = Math.abs(Math.sin(st.phase)) * 0.18 * st.amp;
    B.body.position.y = G + bob + Math.sin(t * 2.1 + st.k) * 0.02;
    B.body.rotation.set(0, 0, st.roll + Math.sin(st.phase) * 0.04 * st.amp);
    B.mat.color.set(st.color);
    // piernas
    for (const s of [-1, 1]) {
      const ph = st.phase + (s > 0 ? Math.PI : 0);
      const hip = new THREE.Vector3(s * 0.55, 0.55, 0.1);
      const ankle = new THREE.Vector3(s * 0.62, -G - bob + 0.3 + Math.max(0, Math.cos(ph)) * 0.4 * st.amp, 0.2 + 0.6 * Math.sin(ph) * st.amp);
      const knee = ik(hip, ankle, 1.45, 1.45, new THREE.Vector3(0, 0, 1));
      const toe = ankle.clone().add(new THREE.Vector3(s * 0.03, -0.04, 0.42));
      setLimb(B, s < 0 ? 'legL' : 'legR', [hip, knee, ankle, toe], legR);
    }
    // brazos (balanceo al andar o saludo)
    for (const s of [-1, 1]) {
      const sh = new THREE.Vector3(s * 1.42, 3.0, 0.05);
      const swing = 0.55 * Math.sin(st.phase + (s > 0 ? 0 : Math.PI)) * st.amp;
      let hand = new THREE.Vector3(s * 1.72, 0.7, 0.25 + swing);
      const w = s === st.waveSide ? st.wave : 0;
      if (w > 0) {
        const wav = Math.sin(t * 14) * 0.45;
        hand = hand.lerp(new THREE.Vector3(s * (2.2 + wav), 5.1, 0.9), w);
      }
      const elbow = ik(sh, hand, 1.25, 1.25, new THREE.Vector3(s, w > 0 ? -0.6 : 0.1, -0.4).normalize());
      setLimb(B, s < 0 ? 'armL' : 'armR', [sh, elbow, hand], armR);
    }
    // cara
    for (const e of B.eyes) e.scale.set(0.125, 0.125 * (1 - st.blink * 0.85), 0.06);
    setMouth(B, st.frown);
  }

  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
  const tanV = Math.tan((30 * Math.PI) / 360), tanH = tanV * (W / H);
  const crew = [];

  return {
    camera,
    render(sh, s) {
      while (crew.length < s.bananas.length) crew.push(makeBanana(COLORS[crew.length % COLORS.length]));
      s.bananas.forEach((b, i) => poseBanana(crew[i], b, s.t));
      // cámara: que quepan todos; con uno solo, el plátano llena la pantalla
      const dH = (9.8 * 1.32) / 2 / tanV;
      const dW = s.cam.hw / tanH;
      const d = Math.max(dH, dW);
      const target = new THREE.Vector3(s.cam.cx, 4.55 + (d - dH) * 0.06, -0.4);
      camera.position.set(target.x, target.y + d * Math.sin(0.1), target.z + d * Math.cos(0.1));
      camera.lookAt(target);
      renderer.render(scene, camera);
    },
    // posición en pantalla de la cabeza de un plátano (para el bocadillo)
    headOnScreen(i) {
      const B = crew[i];
      if (!B) return null;
      const p = new THREE.Vector3(0, HB + 0.6, 0.4).applyMatrix4(B.body.matrixWorld).project(camera);
      return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
    },
  };
}
