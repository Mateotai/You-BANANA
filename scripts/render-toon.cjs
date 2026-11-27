// Renderiza las animaciones del plátano 2D (diseño de la hoja de personaje).
//   node scripts/render-toon.cjs test   -> out/toon-test.mp4  (prueba de movimientos)
//   node scripts/render-toon.cjs show   -> out/toon-show.mp4  (secuencia de 5 plátanos)
//   ... --still 1,2.5,8   (fotogramas sueltos)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const scene = argv[0] || 'show';
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const root = path.resolve(__dirname, '..'), outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[page error]', e));
  await page.goto(`http://localhost:${server.address().port}/src/toon2.html?scene=${scene}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  const META = await page.evaluate(() => window.META);
  const canvas = await page.$('canvas');
  if (opt('still')) {
    for (const t of opt('still').split(',').map(Number)) {
      await page.evaluate((t) => window.renderFrame(t), t);
      const f = path.join(outDir, `toon-${scene}-${t}.png`);
      await canvas.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const dir = path.join(outDir, `frames-toon-${scene}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(META.DURATION * META.FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / META.FPS);
      await canvas.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (i % 90 === 0) console.log(`frame ${i}/${n}`);
    }
    const cues = path.join(outDir, `cues-toon-${scene}.json`), wav = path.join(outDir, `sfx-toon-${scene}.wav`);
    fs.writeFileSync(cues, JSON.stringify({ duration: META.DURATION, cues: META.cues }));
    execFileSync('node', [path.join(__dirname, 'sfx.mjs'), wav, cues], { stdio: 'inherit' });
    const mp4 = path.join(outDir, `toon-${scene}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(META.FPS), '-i', path.join(dir, '%05d.jpg'), '-i', wav,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    console.log('OK ->', mp4);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
