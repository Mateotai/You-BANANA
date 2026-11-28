// Exporta todas las poses del personaje 2D como PNG con fondo transparente (alta resolución).
// Uso: node scripts/export-kit-png.cjs [alto_en_px]   -> personaje/2d/png/
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const H = +(process.argv[2] || 1200);
const out = path.join(root, 'personaje/2d/png');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const POSES = { front: 'frente', front2: 'frente-2', q34: 'tres-cuartos', side: 'perfil', back: 'espalda', walk1: 'caminar-1', walk2: 'caminar-2', walk3: 'caminar-3',
  slump: 'cabizbajo', sit: 'sentado', call: 'llamando', hug: 'abrazando-rodillas' };
const COLORS = { yellow: 'amarillo', green: 'verde', pink: 'rosa', blue: 'azul', purple: 'morado' };
const FACES = { normal: {}, 'u-invertida': { frown: 1 }, 'ojos-cerrados': { blink: 1 } };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/src/kit.html`);
  await page.waitForFunction(() => window.READY === true);
  let n = 0;
  for (const [pose, pname] of Object.entries(POSES)) {
    for (const [pal, cname] of Object.entries(COLORS)) {
      for (const [fname, face] of Object.entries(FACES)) {
        const hasFace = await page.evaluate((p) => window.hasFace(p), pose);
        if (!hasFace && fname !== 'normal') continue;
        const url = await page.evaluate(([p, c, f, h]) => window.renderPose(p, c, f, h), [pose, pal, face, H]);
        fs.writeFileSync(path.join(out, `${pname}_${cname}_${fname}.png`), Buffer.from(url.split(',')[1], 'base64'));
        n++;
      }
    }
  }
  const url = await page.evaluate((h) => window.renderPose('phone', 'yellow', {}, Math.round(h * 0.4)), H);
  fs.writeFileSync(path.join(out, 'movil.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${n + 1} PNG ->`, out);
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
