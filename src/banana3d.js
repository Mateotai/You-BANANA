// Plátano estilo 3D (figura impresa en PLA), con three.js.
// Medidas reales de la figura: 7.2 cm alto, 4.2 cm ancho, 3 cm fondo (1 unidad = 1 cm).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const W = 1080, H = 1920;
const BODY_H = 6.4;
const YELLOW = new THREE.Color('#ffd814');
const GREEN = new THREE.Color('#52b848');

// ---------- forma del cuerpo ----------
// La columna se curva hacia delante (+z): lomo convexo detrás, punta sobre las rodillas.
const spine = (t) => new THREE.Vector3(0, t * BODY_H, 1.5 * t * t - 0.35 * t);
function radiusAt(t) {
  let r;
  if (t < 0.2) {
    const k = (0.2 - t) / 0.2;
    r = Math.pow(Math.max(0, 1 - Math.pow(k, 2.6)), 1 / 2.6);
  } else {
    r = t < 0.3 ? 1 : 1 - 0.6 * Math.pow((t - 0.3) / 0.7, 1.5);
  }
  if (t > 0.965) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.965) / 0.035, 2)));
  return r;
}
const RX = 1.65, RZ = 1.4;
// sección: pentágono redondeado (las aristas del plátano), con una cara plana delante
const FRONT = Math.PI / 2; // dirección +z
function surface(t, th) {
  const c = spine(t);
  const r = radiusAt(t);
  const ridge = 1 + 0.045 * Math.cos(5 * (th - FRONT - Math.PI / 5));
  // la parte de delante algo más plana (donde está la cara)
  const flat = 1 - 0.06 * Math.pow(Math.max(0, Math.cos(th - FRONT)), 4);
  return new THREE.Vector3(c.x + Math.cos(th) * RX * r * ridge, c.y, c.z + Math.sin(th) * RZ * r * ridge * flat);
}
function surfaceFrame(t, th) {
  const e = 1e-3;
  const p = surface(t, th);
  const dth = surface(t, th + e).sub(surface(t, th - e)).normalize();
  const dt = surface(Math.min(1, t + e), th).sub(surface(Math.max(0, t - e), th)).normalize();
  const n = new THREE.Vector3().crossVectors(dth, dt).normalize();
  // aseguramos que apunte hacia fuera
  const c = spine(t);
  if (n.dot(p.clone().sub(c)) < 0) n.negate();
  return { p, n, u: dth, v: dt };
}

function bodyGeometry() {
  const NT = 180, NTH = 96;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NT; i++) {
    const t = i / NT;
    for (let j = 0; j < NTH; j++) {
      const th = (j / NTH) * Math.PI * 2;
      const p = surface(t, th);
      pos.push(p.x, p.y, p.z);
      uv.push(j / NTH, t);
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NTH; j++) {
    const a = i * NTH + j, b = i * NTH + ((j + 1) % NTH), c = (i + 1) * NTH + j, d = (i + 1) * NTH + ((j + 1) % NTH);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

// tubo con puntas redondeadas
function limbGeometry(points, radius, radiusFn) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = new THREE.TubeGeometry(curve, 64, radius, 24, false);
  if (radiusFn) {
    // estrecha/ensancha a lo largo del tubo
    const p = tube.attributes.position;
    const seg = 64, rad = 24;
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg);
      const k = radiusFn(i / seg);
      for (let j = 0; j <= rad; j++) {
        const id = i * (rad + 1) + j;
        const v = new THREE.Vector3().fromBufferAttribute(p, id).sub(c).multiplyScalar(k).add(c);
        p.setXYZ(id, v.x, v.y, v.z);
      }
    }
    tube.computeVertexNormals();
  }
  return { tube, curve };
}

// material con "líneas de impresión" de la PLA (en el eje Y local de la figura)
function plaMaterial(color, rough = 0.5) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLayerY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayerY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLayerY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n float layer = 0.5 + 0.5 * sin(vLayerY * 115.0);\n diffuseColor.rgb *= 1.0 - 0.07 * layer;');
  };
  return m;
}

export async function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // luces: cálida tipo foto de producto
  scene.add(new THREE.HemisphereLight('#fff4e6', '#f2b8b8', 0.55));
  const key = new THREE.DirectionalLight('#fff3df', 2.3);
  key.position.set(-6, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 10; key.shadow.camera.bottom = -6;
  key.shadow.radius = 6; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffd9e0', 1.4);
  rim.position.set(8, 6, -8);
  scene.add(rim);

  // peana blanca redonda
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 1.6, 96), new THREE.MeshStandardMaterial({ color: '#f6eee5', roughness: 0.95 }));
  ped.position.y = -0.8;
  ped.receiveShadow = true;
  scene.add(ped);

  // ---------- figura ----------
  const fig = new THREE.Group(); // pivota en la base (balanceo / giro)
  scene.add(fig);
  const bodyMat = plaMaterial(YELLOW.clone(), 0.48);
  const add = (geo, mat = bodyMat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; fig.add(m); return m; };

  add(bodyGeometry());

  // tallo marrón
  const top = spine(1);
  const stemMat = plaMaterial(new THREE.Color('#8b4a2c'), 0.6);
  const stem = add(new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.14), stemMat);
  const stemDir = spine(1).sub(spine(0.97)).normalize();
  stem.position.copy(top).addScaledVector(stemDir, 0.28);
  stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stemDir);
  stem.rotateY(0.25);
  // la geometría del tallo usa "position.y" para las líneas: lo aplicamos en la malla
  stem.geometry.applyMatrix4(new THREE.Matrix4().compose(stem.position, stem.quaternion, new THREE.Vector3(1, 1, 1)));
  stem.position.set(0, 0, 0); stem.quaternion.identity();

  // piernas: rodillas levantadas, abrazadas por los brazos
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Vector3(s * 0.62, 0.8, 0.7);
    const knee = new THREE.Vector3(s * 0.64, 2.35, 2.25);
    const ankle = new THREE.Vector3(s * 0.74, 0.42, 2.95);
    const { tube } = limbGeometry([hip, new THREE.Vector3(s * 0.63, 1.95, 1.95), knee, new THREE.Vector3(s * 0.7, 1.5, 2.75), ankle], 0.37, (u) => 1 - 0.2 * u);
    add(tube);
    const kneeBall = add(new THREE.SphereGeometry(0.4, 32, 24));
    kneeBall.geometry.scale(1.05, 1, 1.05);
    kneeBall.geometry.translate(knee.x, knee.y + 0.02, knee.z + 0.02);
    const foot = new THREE.SphereGeometry(0.36, 32, 24);
    foot.scale(0.95, 0.62, 1.45);
    foot.translate(s * 0.78, 0.24, 3.2);
    add(foot);
    legs.push({ knee });
  }

  // brazos: del costado a la parte delantera de las rodillas
  for (const s of [-1, 1]) {
    const shoulder = surface(0.5, s > 0 ? 0.15 : Math.PI - 0.15).multiplyScalar(1).add(new THREE.Vector3(-s * 0.15, 0, 0));
    const pts = [
      shoulder,
      new THREE.Vector3(s * 1.85, 2.75, 1.0),
      new THREE.Vector3(s * 1.55, 2.0, 2.4),
      new THREE.Vector3(s * 0.62, 1.7, 2.85),
    ];
    const { tube } = limbGeometry(pts, 0.2);
    add(tube);
    const hand = new THREE.SphereGeometry(0.27, 32, 24);
    hand.scale(1.15, 1, 0.9);
    hand.translate(pts[3].x, pts[3].y, pts[3].z);
    add(hand);
    const sh = new THREE.SphereGeometry(0.2, 24, 16);
    sh.translate(shoulder.x, shoulder.y, shoulder.z);
    add(sh);
  }

  // ---------- cara ----------
  const FACE_T = 0.665;
  const faceMat = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.35 });
  const placeOnSurface = (mesh, t, th, lift = 0.0) => {
    const f = surfaceFrame(t, th);
    const m = new THREE.Matrix4().makeBasis(f.u, f.v, f.n);
    mesh.quaternion.setFromRotationMatrix(m);
    mesh.position.copy(f.p).addScaledVector(f.n, lift);
  };
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), faceMat);
    e.scale.set(1, 1, 0.45);
    e.userData.s = s;
    fig.add(e);
    return e;
  });
  const sparkleMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const sparkles = eyes.map((e) => { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), sparkleMat); fig.add(sp); return sp; });

  const mouthLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42, 8, 16).rotateZ(Math.PI / 2), faceMat);
  mouthLine.scale.set(1, 1, 0.6);
  const mouthO = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), faceMat);
  mouthO.scale.set(0.8, 1.05, 0.4);
  const wavyPts = [];
  for (let i = 0; i <= 24; i++) wavyPts.push(new THREE.Vector3(-0.3 + i * 0.025, Math.sin(i * 0.85) * 0.045, 0));
  const mouthWavy = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wavyPts), 64, 0.045, 10, false), faceMat);
  for (const m of [mouthLine, mouthO, mouthWavy]) fig.add(m);

  // gota de sudor
  const sweatMat = new THREE.MeshPhysicalMaterial({ color: '#8fd8ff', roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.92, clearcoat: 1 });
  const dropGeo = new THREE.SphereGeometry(0.2, 24, 16);
  {
    const p = dropGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) { const k = 1 - y / 0.2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * 2.2); }
    }
    dropGeo.computeVertexNormals();
  }
  const sweat = new THREE.Mesh(dropGeo, sweatMat);
  fig.add(sweat);

  // ---------- cámara ----------
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 200);
  const AZ = -0.7, EL = 0.2, D0 = 40;
  const camDir = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
  const baseTarget = new THREE.Vector3(0.2, 3.3, 0.6);
  const OFFSET0 = -430; // empuja el plátano a la mitad de abajo del encuadre
  const OFFSET_ZOOM = -70;

  function layoutFace(s) {
    const th = FRONT + s.lookX * 0.13;
    const tt = FACE_T - s.lookY * 0.03;
    const sep = 0.36;
    eyes.forEach((e, i) => {
      placeOnSurface(e, tt + 0.04 + (e.userData.s > 0 ? 0.004 : 0), th + e.userData.s * sep, 0.01);
      const sc = s.eyeScale;
      e.scale.set(sc, sc * (1 - s.blink * 0.85), 0.45 * sc);
      const sp = sparkles[i];
      sp.visible = s.eyeScale > 1.2 && s.blink < 0.5;
      sp.position.copy(e.position).add(new THREE.Vector3(-0.05, 0.06, 0).applyQuaternion(e.quaternion).multiplyScalar(sc)).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(e.quaternion), 0.06 * sc);
    });
    mouthLine.visible = s.mouth === 'line';
    mouthO.visible = s.mouth === 'o';
    mouthWavy.visible = s.mouth === 'wavy';
    for (const m of [mouthLine, mouthO, mouthWavy]) placeOnSurface(m, tt - 0.045, th + 0.02, 0.012);
    mouthLine.rotateZ(0.12);
  }

  return {
    render(s) {
      // color (amarillo -> verde)
      bodyMat.color.copy(YELLOW).lerp(GREEN, s.green);

      // pose global: balanceo, respiración, girarse hacia cámara
      fig.rotation.set(s.rock, AZ * s.turn, s.rock * 0.35, 'YXZ');
      fig.scale.set(1 - s.breath * 0.5, 1 + s.breath, 1 - s.breath * 0.5);

      layoutFace(s);

      // sudor
      sweat.visible = s.sweat >= 0;
      if (sweat.visible) placeOnSurface(sweat, 0.8 - s.sweat * 0.22, FRONT - 0.95, 0.12);
      sweat.rotation.z += 0; // la gota mira hacia arriba
      if (sweat.visible) { sweat.quaternion.identity(); sweat.position.copy(surfaceFrame(0.8 - s.sweat * 0.22, FRONT - 0.95).p).addScaledVector(surfaceFrame(0.8 - s.sweat * 0.22, FRONT - 0.95).n, 0.14); }

      // cámara: plano general <-> primerísimo plano de la cara
      fig.updateMatrixWorld(true);
      const faceWorld = surface(FACE_T, FRONT).applyMatrix4(fig.matrixWorld);
      const f = s.zoomFocus;
      const target = baseTarget.clone().lerp(faceWorld, f);
      const dist = D0 / s.zoom;
      camera.position.copy(target).addScaledVector(camDir, dist);
      camera.lookAt(target);
      camera.setViewOffset(W, H, -s.shake.x, OFFSET0 + (OFFSET_ZOOM - OFFSET0) * f - s.shake.y, W, H);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    },
  };
}
