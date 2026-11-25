// Genera la pista de efectos de sonido (WAV mono 44.1 kHz) sincronizada con el guion.
// Uso: node scripts/sfx.mjs out/sfx.wav ['{"shock":9.9,...}']  (plan opcional, en JSON)
import fs from 'fs';
import * as TL from '../src/timeline.js';

if (process.argv[3]) TL.setPlan(JSON.parse(process.argv[3]));
const { SFX_CUES, DURATION } = TL;

const SR = 44100;
const out = new Float32Array(Math.ceil(SR * (DURATION + 0.5)));
let seed = 1234;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function add(t0, dur, fn, gain = 1) {
  const s0 = Math.floor(t0 * SR);
  for (let i = 0; i < dur * SR; i++) {
    const k = s0 + i;
    if (k >= 0 && k < out.length) out[k] += fn(i / SR) * gain;
  }
}
// oscilador con fase acumulada para barridos de frecuencia
function osc(freqFn, shape = Math.sin) {
  let ph = 0, last = 0;
  return (t) => { ph += 2 * Math.PI * freqFn(t) * (t - last || 1 / SR); last = t; return shape(ph); };
}
const saw = (ph) => ((ph / Math.PI) % 2) - 1;

const SYNTH = {
  // parpadeo: "tic" agudo y suave
  blink: (t0, g) => { const o = osc(() => 2400); add(t0, 0.04, (t) => o(t) * Math.exp(-t * 120), 0.25 * g); },
  tick: (t0, g) => { const o = osc((t) => 1500 - t * 8000); add(t0, 0.06, (t) => o(t) * Math.exp(-t * 70), 0.35 * g); },
  // bocadillo: "pop"
  pop: (t0, g) => { const o = osc((t) => 500 + t * 9000); add(t0, 0.09, (t) => o(t) * Math.sin(Math.PI * t / 0.09), 0.45 * g); },
  // "boom" dramático de zoom (grave con bajada de tono + saturación)
  boom: (t0, g) => {
    const o = osc((t) => 42 + 95 * Math.exp(-t * 9));
    const o2 = osc((t) => 84 + 190 * Math.exp(-t * 9));
    add(t0, 1.6, (t) => Math.tanh((o(t) + 0.35 * o2(t)) * 2.2 * Math.exp(-t * 2.6)) + rnd() * 0.25 * Math.exp(-t * 60), 0.7 * g);
  },
  // rayada de disco: chirrido que sube y baja
  scratch: (t0, g) => {
    let lp = 0;
    const o = osc((t) => 260 + 900 * Math.sin(Math.PI * Math.min(1, t / 0.22)) ** 2);
    add(t0, 0.28, (t) => { lp += 0.35 * (rnd() - lp); return (0.6 * saw(0) * 0 + 0.55 * o(t) + 0.5 * lp) * Math.sin(Math.PI * t / 0.28); }, 0.55 * g);
  },
  // whoosh al volver al plano general
  whoosh: (t0, g) => {
    let lp = 0;
    add(t0, 0.35, (t) => { const a = 0.05 + 0.5 * (t / 0.35); lp += a * (rnd() - lp); return lp * Math.sin(Math.PI * t / 0.35); }, 1.1 * g);
  },
  // trombón triste: wah wah wah waaah
  sad: (t0, g) => {
    const notes = [[0, 0.32, 233.1], [0.36, 0.32, 220.0], [0.72, 0.32, 207.7], [1.08, 1.1, 196.0]];
    for (const [st, d, f] of notes) {
      const vib = st > 1 ? 6 : 0;
      const o = osc((t) => f * (1 + 0.012 * Math.sin(2 * Math.PI * vib * t)), saw);
      let lp = 0;
      add(t0 + st, d, (t) => {
        const env = Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08);
        const wah = 0.08 + 0.25 * Math.min(1, t / 0.15); // se "abre" como una sordina
        lp += wah * (o(t) - lp);
        return lp * env;
      }, 0.5 * g);
    }
  },
  // rebobinado rápido
  rewind: (t0, g) => {
    const o = osc((t) => 1400 - 900 * Math.sin(t * 60) * 0.3 - t * 1500, saw);
    let lp = 0;
    add(t0, 0.45, (t) => { lp += 0.2 * (o(t) - lp); return lp * Math.sin(Math.PI * t / 0.45) * (0.6 + 0.4 * Math.sin(t * 90)); }, 0.35 * g);
  },
};

for (const c of SFX_CUES) SYNTH[c.type](c.t, c.gain);

// normalizar y escribir WAV PCM16
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const norm = peak > 0 ? 0.89 / peak : 1;
const buf = Buffer.alloc(44 + out.length * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + out.length * 2, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * norm)) * 32767), 44 + i * 2);
fs.writeFileSync(process.argv[2] || 'sfx.wav', buf);
console.log('sfx ->', process.argv[2] || 'sfx.wav');
