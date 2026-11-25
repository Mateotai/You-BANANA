// Renderiza el video frame a frame con Chromium headless y lo codifica con ffmpeg.
// Uso:
//   node scripts/render.cjs --mode 2d            -> out/banana-2d.mp4
//   node scripts/render.cjs --mode 3d            -> out/banana-3d.mp4
//   node scripts/render.cjs --mode 3d --still 7.7  -> out/still-3d-7.7.png
//   --screen green  pinta la pantalla en verde chroma (#00ff00) para meter tu video en CapCut/Premiere
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

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[page error]', e));
  const q = `mode=${mode}` + (args.screen ? `&screen=${args.screen}` : '');
  await page.goto(`http://localhost:${port}/src/stage.html?${q}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const { DURATION, FPS } = await page.evaluate(() => window.META);
  const stage = await page.$('#stage');

  if (args.still !== undefined) {
    const stills = String(args.still).split(',').map(Number);
    for (const t of stills) {
      await page.evaluate((t) => window.renderFrame(t), t);
      const f = path.join(outDir, `still-${mode}-${t}.png`);
      await stage.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const suffix = args.screen === 'green' ? '-greenscreen' : '';
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
    execFileSync('node', [path.join(__dirname, 'sfx.mjs'), wav], { stdio: 'inherit' });
    const mp4 = path.join(outDir, `banana-${mode}${suffix}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), '-i', wav,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    console.log('OK ->', mp4);
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
