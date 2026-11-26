// Captura una página del proyecto: node scripts/shot.cjs ruta/pagina.html?params salida.png [ancho alto]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const [, , page_, out, w = 1080, h = 1920] = process.argv;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.error('[page error]', e));
  p.on('console', (m) => console.log('[page]', m.text()));
  await p.goto(`http://localhost:${server.address().port}/${page_}`);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  await p.screenshot({ path: out });
  await b.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
