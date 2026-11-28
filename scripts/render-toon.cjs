// Renderiza las animaciones del plátano 2D (diseño de la hoja de personaje).
//   node scripts/render-toon.cjs test   -> out/toon-test.mp4  (prueba de movimientos)
//   node scripts/render-toon.cjs show   -> out/toon-show.mp4  (secuencia de 5 plátanos)
//   ... --style bitmap   (versión anterior, con la imagen de la hoja ampliada)
//   ... --bg green --clips personaje/2d/clips   (fondo verde de croma y un clip por movimiento)
//   ... --page toy3d   (versión 3D)
//   ... --plan reactions/tres-clips.json   (clips de verdad en vez de pantallas negras, con su audio)
//   ... --still 1,2.5,8   (fotogramas sueltos)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const scene = argv[0] || 'show';
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const root = path.resolve(__dirname, '..'), outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

// --plan: lista de clips (se extraen sus fotogramas para que la página los muestre)
let plan = null, cfg = null;
if (opt('plan')) {
  const planPath = path.resolve(root, opt('plan'));
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  plan.name = plan.name || path.basename(planPath, '.json');
  cfg = { layout: plan.layout || null, videos: [] };
  plan.videos.forEach((v, i) => {
    v.src = path.resolve(path.dirname(planPath), v.video);
    const fdir = path.join(outDir, 'shows', plan.name, `v${i + 1}`);
    fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
    const args = ['-loglevel', 'error'];
    if (v.trimStart) args.push('-ss', String(v.trimStart));
    if (v.trimEnd) args.push('-to', String(v.trimEnd));
    execFileSync('ffmpeg', [...args, '-i', v.src, '-vf', 'fps=30', '-q:v', '2', path.join(fdir, '%05d.jpg')]);
    const n = fs.readdirSync(fdir).length;
    cfg.videos.push({ frames: '/' + path.relative(root, fdir).split(path.sep).join('/') + '/', n, len: n / 30 });
    console.log(`clip ${i + 1}: ${path.basename(v.src)} (${(n / 30).toFixed(2)} s)`);
  });
}
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
  const pageName = opt('page') || 'sprite2d';
  const style = opt('style') || 'vector';
  const bg = opt('bg') || '';
  const tag = `${pageName}-${scene}${opt('style') === 'bitmap' ? '-bitmap' : ''}${plan ? '-' + plan.name : ''}${bg ? '-' + bg : ''}`;
  await page.goto(`http://localhost:${server.address().port}/src/${pageName}.html?scene=${scene}&style=${style}${bg ? '&bg=' + bg : ''}${cfg ? '&cfg=' + encodeURIComponent(JSON.stringify(cfg)) : ''}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  const META = await page.evaluate(() => window.META);
  const canvas = await page.$('canvas');
  if (opt('still')) {
    for (const t of opt('still').split(',').map(Number)) {
      await page.evaluate((t) => window.renderFrame(t), t);
      const f = path.join(outDir, `${tag}-${t}.png`);
      await canvas.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const dir = path.join(outDir, `frames-${tag}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(META.DURATION * META.FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.renderFrame(t), i / META.FPS);
      await canvas.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (i % 90 === 0) console.log(`frame ${i}/${n}`);
    }
    const cues = path.join(outDir, `cues-${tag}.json`), wav = path.join(outDir, `sfx-${tag}.wav`);
    fs.writeFileSync(cues, JSON.stringify({ duration: META.DURATION, cues: META.cues }));
    execFileSync('node', [path.join(__dirname, 'sfx.mjs'), wav, cues], { stdio: 'inherit' });
    const mp4 = path.join(outDir, `${tag}.mp4`);
    if (opt('clips')) {
      // un clip por movimiento (según los rótulos de la prueba), sin sonido
      const clipDir = path.resolve(root, opt('clips'));
      fs.mkdirSync(clipDir, { recursive: true });
      const slug = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      META.labels.forEach(([a, b, text], i) => {
        const f = path.join(clipDir, `${String(i + 1).padStart(2, '0')}-${slug(text)}.mp4`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(META.FPS), '-start_number', String(Math.round(a * META.FPS)), '-i', path.join(dir, '%05d.jpg'),
          '-frames:v', String(Math.round((b - a) * META.FPS)), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', f], { stdio: 'inherit' });
        console.log('clip ->', f);
      });
    }
    const enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
    if (!plan) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(META.FPS), '-i', path.join(dir, '%05d.jpg'), '-i', wav, ...enc, '-shortest', mp4], { stdio: 'inherit' });
    } else {
      // efectos + el audio de cada clip justo cuando se ve
      const inputs = ['-framerate', String(META.FPS), '-i', path.join(dir, '%05d.jpg'), '-i', wav];
      const fc = [`[1:a]volume=${plan.sfxVolume ?? 0.8}[fx]`], mix = ['[fx]'];
      plan.videos.forEach((v, i) => {
        const [a] = META.videos[i];
        inputs.push('-i', v.src);
        const k = i + 2;
        const trim = v.trimStart || v.trimEnd ? `atrim=start=${v.trimStart || 0}${v.trimEnd ? ':end=' + v.trimEnd : ''},asetpts=PTS-STARTPTS,` : '';
        fc.push(`[${k}:a]${trim}adelay=delays=${Math.round(a * 1000)}:all=1,volume=${v.volume ?? plan.volume ?? 1.3}[v${k}]`);
        mix.push(`[v${k}]`);
      });
      fc.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first,alimiter=limit=0.95[aout]`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc.join(';'), '-map', '0:v', '-map', '[aout]', ...enc, '-t', String(META.DURATION), mp4], { stdio: 'inherit' });
    }
    console.log('OK ->', mp4);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
