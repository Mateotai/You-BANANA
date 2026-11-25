// Renderiza el video frame a frame con Chromium headless y lo codifica con ffmpeg.
// Uso:
//   node scripts/render.cjs --mode 2d            -> out/banana-2d.mp4
//   node scripts/render.cjs --mode 3d            -> out/banana-3d.mp4
//   node scripts/render.cjs --mode 3d --still 7.7  -> out/still-3d-7.7.png
//   --screen green  pinta la pantalla en verde chroma (#00ff00) para meter tu video en CapCut/Premiere
//   --plan reactions/ejemplo.json  mete un video viral de verdad en la pantalla, sincronizado
//                                  (ver reactions/README.md)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const mode = args.mode || '2d';
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

// ---- reacción a un video real (opcional)
let plan = null, timelinePlan = null, framesUrl = '', nFrames = 0;
if (args.plan) {
  plan = JSON.parse(fs.readFileSync(path.resolve(root, args.plan), 'utf8'));
  plan.name = plan.name || path.basename(args.plan, '.json');
  const src = path.resolve(path.dirname(path.resolve(root, args.plan)), plan.video);
  const t0 = plan.trimStart || 0;
  const t1 = plan.trimEnd || parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  plan.src = src; plan.t0 = t0; plan.t1 = t1;
  const fdir = path.join(outDir, 'reactions', plan.name, 'frames');
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(t0), '-to', String(t1), '-i', src, '-vf', 'fps=30', '-q:v', '3', path.join(fdir, '%05d.jpg')], { stdio: 'inherit' });
  nFrames = fs.readdirSync(fdir).length;
  framesUrl = '/' + path.relative(root, fdir).split(path.sep).join('/') + '/';
  timelinePlan = { ...(plan.timeline || {}), videoLength: t1 - t0 };
  console.log(`viral: ${path.basename(src)} ${t0}-${t1}s, ${nFrames} fotogramas`);
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[page error]', e));
  let q = `mode=${mode}` + (args.screen ? `&screen=${args.screen}` : '') + (args.ref ? '&ref=1' : '');
  if (plan) q += `&plan=${encodeURIComponent(JSON.stringify(timelinePlan))}&frames=${encodeURIComponent(framesUrl)}&nframes=${nFrames}&fit=${plan.fit || 'contain'}&focusY=${plan.focusY ?? 0.5}`;
  await page.goto(`http://localhost:${port}/src/stage.html?${q}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const { DURATION, FPS } = await page.evaluate(() => window.META);
  const stage = await page.$('#stage');

  if (args.still !== undefined) {
    const stills = String(args.still).split(',').map(Number);
    for (const t of stills) {
      await page.evaluate((t) => window.renderFrame(t), t);
      const f = path.join(outDir, `still-${mode}${args.ref ? '-ref' : ''}-${t}.png`);
      await stage.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const suffix = (args.screen === 'green' ? '-greenscreen' : '') + (plan ? `-${plan.name}` : '');
    const framesDir = path.join(outDir, `frames-${mode}${suffix}`);
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    const n = Math.round(DURATION * FPS);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / FPS);
      await stage.screenshot({ path: path.join(framesDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (i % 30 === 0) console.log(`frame ${i}/${n}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    const wav = path.join(outDir, 'sfx.wav');
    execFileSync('node', [path.join(__dirname, 'sfx.mjs'), wav, ...(timelinePlan ? [JSON.stringify(timelinePlan)] : [])], { stdio: 'inherit' });
    const mp4 = path.join(outDir, `banana-${mode}${suffix}.mp4`);
    const enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
    if (!plan) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), '-i', wav, ...enc, '-shortest', mp4], { stdio: 'inherit' });
    } else {
      // audio del viral: suena al empezar y otra vez en el replay; baja durante el "..." para que se note el silencio
      const B = await page.evaluate(() => window.META.BEATS);
      const vs = timelinePlan.videoStart ?? timelinePlan.lookUp ?? 1;
      const gain = plan.volume ?? 1.6, duck = plan.duck ?? 0.3, sfxGain = plan.sfxVolume ?? 0.8;
      const ms = (x) => Math.round(x * 1000);
      const fc = [
        `[2:a]atrim=start=${plan.t0}:end=${plan.t1},asetpts=PTS-STARTPTS,asplit=2[a1][a2]`,
        `[a1]adelay=delays=${ms(vs)}:all=1,volume='${gain}*if(between(t,${B.glance},${B.backToVideo}),${duck},1)':eval=frame[v1]`,
        `[a2]adelay=delays=${ms(B.replay + 0.5)}:all=1,volume=${gain}[v2]`,
        `[1:a]volume=${sfxGain}[fx]`,
        `[fx][v1][v2]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[aout]`,
      ].join(';');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), '-i', wav, '-i', plan.src,
        '-filter_complex', fc, '-map', '0:v', '-map', '[aout]', ...enc, '-t', String(DURATION), mp4], { stdio: 'inherit' });
    }
    console.log('OK ->', mp4);
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
