// Renderiza un "programa" de reacciones en cadena con el plátano 2D articulado.
// Uso:
//   node scripts/render-show.cjs reactions/episodio.json --format sofa   -> out/show-<nombre>-sofa.mp4
//   node scripts/render-show.cjs reactions/episodio.json --format pie    -> out/show-<nombre>-pie.mp4
//   node scripts/render-show.cjs reactions/episodio.json --format pie3d  -> 3D, con pandilla de plátanos
//   ... --still 1,5.5,20   (sólo fotogramas sueltos en PNG)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const planPath = argv.find((a) => a.endsWith('.json'));
const format = opt('format', 'sofa');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
const plan = JSON.parse(fs.readFileSync(path.resolve(root, planPath), 'utf8'));
const name = plan.name || path.basename(planPath, '.json');
const planDir = path.dirname(path.resolve(root, planPath));

// prepara cada video: recorte + fotogramas
const items = plan.videos.map((v, i) => {
  if (!v.video) return { kind: 'placeholder', text: v.placeholder || `VIDEO ${i + 1}`, len: v.duration || 4 };
  const src = path.resolve(planDir, v.video);
  const t0 = v.trimStart || 0;
  const t1 = v.trimEnd || parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  const fdir = path.join(outDir, 'shows', name, `v${i + 1}`);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(t0), '-to', String(t1), '-i', src, '-vf', 'fps=30', '-q:v', '3', path.join(fdir, '%05d.jpg')]);
  const n = fs.readdirSync(fdir).length;
  return { kind: 'video', len: n / 30, frames: '/' + path.relative(root, fdir).split(path.sep).join('/') + '/', n, focusY: v.focusY ?? 0.5, src, t0, t1, volume: v.volume ?? 1.6 };
});
const cfg = { format, react: plan.react, items: items.map(({ src, t0, t1, volume, ...rest }) => rest) };

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[page error]', e));
  const pageFile = format === 'pie3d' ? 'show3d.html' : 'show.html';
  await page.goto(`http://localhost:${server.address().port}/src/${pageFile}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  const META = await page.evaluate(() => window.META);
  const canvas = await page.$(format === 'pie3d' ? '#stage' : 'canvas');
  const still = opt('still');
  if (still) {
    for (const t of still.split(',').map(Number)) {
      await page.evaluate((t) => window.renderFrame(t), t);
      const f = path.join(outDir, `show-${format}-${t}.png`);
      await canvas.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const framesDir = path.join(outDir, `frames-show-${format}`);
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    const n = Math.round(META.DURATION * META.FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / META.FPS);
      await canvas.screenshot({ path: path.join(framesDir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      if (i % 60 === 0) console.log(`frame ${i}/${n}`);
    }
    // efectos de sonido + audio de cada viral en su sitio
    const cuesFile = path.join(outDir, `cues-${format}.json`);
    fs.writeFileSync(cuesFile, JSON.stringify({ duration: META.DURATION, cues: META.cues }));
    const wav = path.join(outDir, `sfx-show-${format}.wav`);
    execFileSync('node', [path.join(__dirname, 'sfx.mjs'), wav, cuesFile], { stdio: 'inherit' });
    const inputs = ['-framerate', String(META.FPS), '-i', path.join(framesDir, '%05d.jpg'), '-i', wav];
    const fc = [`[1:a]volume=${plan.sfxVolume ?? 0.8}[fx]`];
    const mix = ['[fx]'];
    let k = 2;
    items.forEach((it, i) => {
      if (it.kind !== 'video') return;
      inputs.push('-i', it.src);
      const at = Math.round(META.plays[i][0] * 1000);
      fc.push(`[${k}:a]atrim=start=${it.t0}:end=${it.t1},asetpts=PTS-STARTPTS,adelay=delays=${at}:all=1,volume=${it.volume}[v${k}]`);
      mix.push(`[v${k}]`);
      k++;
    });
    fc.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first,alimiter=limit=0.95[aout]`);
    const mp4 = path.join(outDir, `show-${name}-${format}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc.join(';'), '-map', '0:v', '-map', '[aout]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(META.DURATION), mp4], { stdio: 'inherit' });
    console.log('OK ->', mp4);
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
