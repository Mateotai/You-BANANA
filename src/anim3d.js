// Escenas animadas del plátano 3D. Usa el mismo guion que la versión 2D (src/toon-anim.js):
//   test: prueba de movimientos · show: secuencia de 5 plátanos con pantallas negras como videos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Banana3D, PALETTE3D } from './toy3d.js';
import { buildShow, buildTest, frameState, FPS } from './toon-anim.js';

export { buildShow, buildTest, FPS };
export const W = 1080, H = 1920;
const BG = '#d2c8c5'; // fondo de estudio (medido en la hoja 3D)

// móvil en su soporte (visto por detrás, como en la hoja): grafito con módulo de cámara y patita
function makePhone() {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: '#4a494e', roughness: 0.32, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#2c2b2f', roughness: 0.4, metalness: 0.2, clearcoat: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0b0b0e', roughness: 0.05, clearcoat: 1 });
  const ring = new THREE.MeshPhysicalMaterial({ color: '#77767c', roughness: 0.25, metalness: 0.8 });
  const phone = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.4, 0.03, 5, 0.026), body);
  phone.add(slab);
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.125, 0.014, 4, 0.02), dark);
  bump.position.set(-0.042, 0.115, -0.019); phone.add(bump);
  for (const y of [0.145, 0.088]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 32), ring); r.rotation.x = Math.PI / 2; r.position.set(-0.044, y, -0.027); phone.add(r);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 32), glass); l.rotation.x = Math.PI / 2; l.position.set(-0.044, y, -0.029); phone.add(l);
  }
  phone.position.set(0, 0.205, 0); phone.rotation.x = -0.2;
  const stand = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.2, 0.012, 3, 0.006), dark);
  stand.position.set(0, 0.095, -0.075); stand.rotation.x = 0.6;
  g.add(phone, stand);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

export function createScene3D(glCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.15;
  scene.add(new THREE.HemisphereLight('#ffffff', '#e8dccf', 2.15));
  const key = new THREE.DirectionalLight('#fff8ee', 0.65); key.position.set(3.5, 6, 3.5); scene.add(key);
  const top = new THREE.DirectionalLight('#ffffff', 0.08); top.position.set(0.4, 8, 1.2); top.castShadow = true;
  top.shadow.mapSize.set(2048, 2048); Object.assign(top.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.1, far: 20 });
  top.shadow.radius = 18; top.shadow.blurSamples = 24; top.shadow.bias = -0.0005;
  scene.add(top, top.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 100);
  const EL = 0.24;
  const phone = makePhone(); scene.add(phone);
  const crew = [];
  return {
    render(sh, t) {
      const fs = frameState(sh, t);
      if (fs.video) return fs;
      while (crew.length < fs.chars.length) { const b = new Banana3D(); crew.push(b); scene.add(b.root); }
      fs.chars.forEach((c, i) => {
        const b = crew[i];
        b.root.visible = c.visible;
        if (!c.visible) return;
        b.setColor(PALETTE3D[c.palName] || PALETTE3D.yellow);
        b.root.position.set(c.x, 0, -c.wz);
        b.update(c);
      });
      phone.visible = !!fs.phone;
      if (fs.phone) { phone.position.set(fs.phone[0], 0, -fs.phone[1]); phone.rotation.y = Math.PI + 0.5; } // un poco girado: se ve en 3/4
      // cámara: mismo encuadre que la versión 2D (centro x, altura y, zoom en px por unidad)
      // (un poco más abierto que en 2D: la cámara 3D está algo elevada y tiene perspectiva)
      const d = (H / 2) / (Math.tan((24 * Math.PI) / 360) * fs.cam.z * 0.86);
      const tz = fs.single ? 0 : -0.3;
      const target = new THREE.Vector3(fs.cam.x, fs.cam.y + 0.16, tz);
      camera.position.set(target.x, target.y + d * Math.sin(EL), target.z + d * Math.cos(EL));
      camera.lookAt(target);
      top.position.set(target.x + 0.4, 8, target.z + 1.2); top.target.position.set(target.x, 0, target.z);
      renderer.render(scene, camera);
      return fs;
    },
  };
}

// pantalla negra "VIDEO n" y rótulos (en el lienzo 2D que se graba)
export function drawOverlay(ctx, fs, glCanvas) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (fs.video) {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 170px Rubik, Arial, sans-serif'; ctx.fillText(`VIDEO ${fs.video[2]}`, W / 2, H / 2 - 20);
    ctx.globalAlpha = 0.45; ctx.font = '600 38px Rubik, Arial, sans-serif'; ctx.fillText('aquí va el video viral', W / 2, H / 2 + 110); ctx.globalAlpha = 1;
    return;
  }
  ctx.drawImage(glCanvas, 0, 0, W, H);
  if (fs.label) {
    ctx.fillStyle = '#2a2220'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '700 46px Rubik, Arial, sans-serif'; ctx.fillText(fs.label, W / 2, 150);
  }
}
