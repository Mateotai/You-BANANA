// Exporta las imágenes del canal de YouTube (src/brand.html) a personaje/canal/.
// Uso: node scripts/export-brand.cjs ["Nombre del canal"] ["Texto 1"] ["Texto 2"]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'personaje/canal');
fs.mkdirSync(out, { recursive: true });
const [name, t1, t2] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const save = (f, url) => fs.writeFileSync(path.join(out, f), Buffer.from(url.split(',')[1], 'base64'));
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const qs = new URLSearchParams();
  if (name) qs.set('name', name); if (t1) qs.set('t1', t1); if (t2 !== undefined) qs.set('t2', t2);
  await page.goto(`http://localhost:${server.address().port}/src/brand.html?${qs}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  save('foto-perfil-800x800.png', await page.evaluate(() => window.renderAvatar(800)));
  save('banner-2560x1440.png', await page.evaluate(() => window.renderBanner(false)));
  save('banner-zonas-guia.png', await page.evaluate(() => window.renderBanner(true)));
  save('marca-de-agua-150x150.png', await page.evaluate(() => window.renderWatermark()));
  console.log('OK ->', out);
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
