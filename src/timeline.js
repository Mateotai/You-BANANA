// Guion del video de reacción (compartido por la versión 2D y la 3D).
// Todo es una función pura del tiempo t (segundos) -> estado de la escena,
// así cada frame se puede renderizar de forma determinista.

export const FPS = 30;

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (t0, t1, t) => {
  const x = clamp((t - t0) / (t1 - t0));
  return x * x * (3 - 2 * x);
};
// sube en [a,b] y baja en [c,d]
const window4 = (a, b, c, d, t) => smooth(a, b, t) * (1 - smooth(c, d, t));
// pulso triangular para parpadeos
const pulse = (t0, dur, t) => {
  const x = (t - t0) / dur;
  if (x < 0 || x > 1) return 0;
  return 1 - Math.abs(x * 2 - 1);
};
// "pop" con rebote para bocadillos / iconos
const popIn = (t0, t) => {
  const x = clamp((t - t0) / 0.22);
  if (x <= 0) return 0;
  return 1 + Math.sin(x * Math.PI) * 0.25 * (1 - x) - (1 - x) * (1 - x) * 0.0;
};

// ---------- momentos clave (segundos) ----------
// Un "plan" fija los pocos momentos que dependen del video viral; el resto se deriva.
//   lookUp:      empieza a mirar la pantalla
//   glance:      mira a cámara con "..." (rompe la cuarta pared)
//   glance2:     (opcional) mirada rápida a cámara, tipo "doble toma"
//   shock:       el momento fuerte del viral -> zoom dramático
//   rockDur:     cuánto dura el balanceo "traumatizado"
//   videoStart:  cuándo empieza a sonar/verse el viral; videoLength: cuánto dura
export const DEFAULT_PLAN = { lookUp: 1.0, glance: 4.0, glance2: null, shock: 6.6, rockDur: 3.0, videoStart: 1.0, videoLength: 13.5 };
export let PLAN = { ...DEFAULT_PLAN };
export let BEATS = {};
export let BLINKS = [];
export let SFX_CUES = [];
export let DURATION = 16;

export function setPlan(p = {}) {
  PLAN = { ...DEFAULT_PLAN, ...p };
  if (p.videoStart === undefined) PLAN.videoStart = PLAN.lookUp;
  const P = PLAN;
  const B = {
    lookUp: P.lookUp,
    glance: P.glance,
    bubble: P.glance + 0.6, // "..."
    backToVideo: P.glance + 1.8,
    glance2: P.glance2,
    shock: P.shock, // pasa algo en el video
    zoom1: P.shock + 0.2,
    zoom2: P.shock + 0.6,
    zoom3: P.shock + 1.0,
    closeBlink: P.shock + 2.1, // tras los BOOM: silencio... y un parpadeo lento
    cutBack: P.shock + 3.0, // vuelve el plano general
  };
  B.rockStart = B.cutBack + 0.2;
  B.rockEnd = B.rockStart + P.rockDur;
  B.replay = B.rockEnd + 0.4; // ...y le vuelve a dar al play
  B.finalGlance = B.replay + 1.0;
  B.finalBack = B.replay + 2.2;
  BEATS = B;
  DURATION = Math.round((B.replay + 2.8) * 10) / 10;
  BLINKS = [
    [B.lookUp - 0.3, 0.16],
    [B.lookUp + 1.6, 0.16],
    [B.glance + 1.15, 0.45], // parpadeo lento y juzgón mientras mira a cámara
    [B.closeBlink, 0.5], // parpadeo lento en primerísimo plano, después de los BOOM
    [B.rockStart + 1.5, 0.2],
    [B.finalGlance + 0.4, 0.16],
    [B.finalGlance + 0.7, 0.16],
  ].filter(([bt]) => bt >= 0.2);
  // efectos de sonido sincronizados (los usa scripts/sfx.mjs)
  SFX_CUES = [
    ...BLINKS.map(([t, d]) => ({ t, type: 'blink', gain: d > 0.3 ? 0.5 : 0.35 })),
    { t: B.glance, type: 'tick', gain: 0.5 },
    { t: B.bubble, type: 'pop', gain: 0.7 },
    ...(B.glance2 != null ? [{ t: B.glance2, type: 'tick', gain: 0.5 }] : []),
    { t: B.shock, type: 'scratch', gain: 0.8 },
    { t: B.zoom1, type: 'boom', gain: 0.55 },
    { t: B.zoom2, type: 'boom', gain: 0.75 },
    { t: B.zoom3, type: 'boom', gain: 1.0 },
    { t: B.cutBack - 0.08, type: 'whoosh', gain: 0.7 },
    { t: B.rockStart + 0.1, type: 'sad', gain: 0.55 },
    { t: B.replay, type: 'rewind', gain: 0.6 },
    { t: B.finalGlance, type: 'tick', gain: 0.5 },
  ];
  return PLAN;
}
setPlan();

// segundo del viral que se ve en el instante t (con el replay del final)
export function videoTimeAt(t) {
  const B = BEATS, P = PLAN;
  if (t < B.replay) return clamp(t - P.videoStart, 0, P.videoLength);
  return clamp(t - (B.replay + 0.5), 0, P.videoLength);
}

// Sacudida pseudo-aleatoria pero determinista
function shakeAt(t, amp) {
  return {
    x: amp * (Math.sin(t * 91.7) * 0.6 + Math.sin(t * 57.3 + 1.3) * 0.4),
    y: amp * (Math.sin(t * 77.1 + 2.1) * 0.6 + Math.sin(t * 43.9) * 0.4),
  };
}

export function getState(t) {
  const B = BEATS;
  const s = {};

  // ----- mirada -----
  // lookY: 0 = a cámara, -1 = hacia arriba (al video)
  let lookY = 0;
  lookY -= smooth(B.lookUp, B.lookUp + 0.35, t);
  lookY += smooth(B.glance, B.glance + 0.22, t); // de golpe a cámara
  lookY -= smooth(B.backToVideo, B.backToVideo + 0.3, t);
  lookY += smooth(B.zoom1 - 0.05, B.zoom1, t); // en el zoom mira a cámara
  lookY -= smooth(B.rockEnd, B.rockEnd + 0.4, t); // vuelve a mirar el video
  lookY += smooth(B.finalGlance, B.finalGlance + 0.2, t);
  lookY -= smooth(B.finalBack, B.finalBack + 0.3, t);
  // doble toma: mirada rapidísima a cámara y vuelta al video
  const g2 = B.glance2 != null ? window4(B.glance2, B.glance2 + 0.1, B.glance2 + 0.55, B.glance2 + 0.75, t) : 0;
  lookY += g2;
  s.lookY = lookY;

  // lookX: sigue "la acción" del video
  let lookX = 0;
  lookX += 0.4 * Math.sin((t - B.lookUp) * 2.3) * window4(B.lookUp + 0.3, B.lookUp + 0.8, B.glance - 0.2, B.glance, t);
  lookX += 0.3 * Math.sin((t - B.backToVideo) * 2.0) * window4(B.backToVideo + 0.4, B.backToVideo + 0.9, B.shock - 0.3, B.shock, t) * (1 - g2);
  lookX += 0.3 * Math.sin((t - B.replay) * 2.6) * window4(B.replay + 0.2, B.replay + 0.5, B.finalGlance - 0.1, B.finalGlance, t);
  s.lookX = lookX;

  // ----- girar el cuerpo hacia cámara (sólo se nota en 3D) -----
  let turn = 0;
  turn += window4(B.glance, B.glance + 0.3, B.backToVideo, B.backToVideo + 0.35, t);
  turn += window4(B.zoom1 - 0.05, B.zoom1, B.cutBack, B.cutBack + 0.01, t);
  turn += 0.45 * window4(B.cutBack, B.cutBack + 0.01, B.rockEnd, B.rockEnd + 0.4, t);
  turn += window4(B.finalGlance, B.finalGlance + 0.3, B.finalBack, B.finalBack + 0.35, t);
  turn += 0.7 * g2;
  s.turn = turn;

  // ----- parpadeo -----
  s.blink = Math.max(...BLINKS.map(([bt, d]) => pulse(bt, d, t)));

  // La cara NO cambia nunca (dos puntos y una raya, como la figura):
  // el chiste es justo esa cara de póker, incluso en el zoom dramático.
  const shocked = t >= B.zoom1 && t < B.cutBack;

  // se echa un poco hacia atrás cuando mira la pantalla (que está encima)
  s.lean = clamp(-lookY);

  // ----- gota de sudor -----
  const sweatStart = B.closeBlink + 0.35;
  s.sweat = t >= sweatStart && t < B.rockEnd ? clamp((t - sweatStart) / (B.rockEnd - sweatStart)) : -1;

  // ----- balanceo abrazando las rodillas (modo trauma) -----
  const rockEnv = window4(B.rockStart, B.rockStart + 0.5, B.rockEnd - 0.5, B.rockEnd, t);
  s.rock = 0.09 * rockEnv * Math.sin((t - B.rockStart) * Math.PI * 2 * 1.1);

  // respiración / idle
  s.breath = Math.sin(t * 2.2) * 0.008;

  // ----- zoom dramático tipo meme -----
  let zoom = 1;
  const steps = [
    [B.zoom1, 1.7],
    [B.zoom2, 2.7],
    [B.zoom3, 4.2],
  ];
  for (const [zt, zv] of steps) {
    if (t >= zt && t < B.cutBack) {
      const k = clamp((t - zt) / 0.07);
      const prev = zoom;
      zoom = lerp(prev, zv, k) * (1 + 0.03 * Math.exp(-(t - zt) * 10)); // pequeño rebote
    }
  }
  s.zoom = zoom;
  s.zoomFocus = zoom > 1 ? clamp((zoom - 1) / (4.2 - 1)) : 0;

  // sacudida de cámara
  let shakeAmp = 0;
  for (const [zt] of steps) if (t >= zt && t < B.cutBack) shakeAmp = Math.max(shakeAmp, 22 * Math.exp(-(t - zt) * 9));
  if (t >= B.zoom3 && t < B.cutBack) shakeAmp = Math.max(shakeAmp, 3);
  s.shake = shakeAt(t, shakeAmp);

  s.vignette = shocked ? 0.75 : 0;

  // ----- bocadillo -----
  s.bubble = null;
  if (t >= B.bubble && t < B.backToVideo) s.bubble = { text: '...', scale: popIn(B.bubble, t) };

  // ----- pantalla del video -----
  const v = {};
  v.time = videoTimeAt(t);
  v.progress = v.time / PLAN.videoLength;
  v.flash = t >= B.shock ? Math.exp(-(t - B.shock) * 9) * (t < B.cutBack ? 1 : 0) : 0;
  v.shake = t >= B.shock && t < B.zoom1 + 0.1 ? shakeAt(t, 16) : { x: 0, y: 0 };
  v.hidden = shocked ? 1 : 0;
  v.replay = t >= B.replay && t < B.replay + 0.9 ? popIn(B.replay, t) : 0;
  s.video = v;

  return s;
}
