// Local server for trying the site + API without a Netlify account:
//   npm run build -- http://localhost:8888 && npm run serve:local
// Serves dist/ and routes the API paths to the real function handlers in netlify/functions/,
// calling them the way Netlify does (a web Request in, a web Response out, plus a context object).
// For the official emulator use `npx netlify-cli dev` instead (see API.md).

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8888);

const functions = await Promise.all(
  ['search', 'health', 'mcp'].map(async (name) => {
    const mod = await import(`../netlify/functions/${name}.mjs`);
    return { name, handler: mod.default, config: mod.config, paths: [].concat(mod.config.path) };
  }),
);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const fn = functions.find((f) => f.paths.includes(url.pathname));
    if (fn) {
      if (fn.config.method && !fn.config.method.includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await fn.handler(request, { ip: req.socket.remoteAddress, site: { url: `http://localhost:${PORT}` } });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(existsSync(join(DIST, '404.html')) ? readFileSync(join(DIST, '404.html')) : 'Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  })
  .listen(PORT, () => {
    console.log(`Site + API on http://localhost:${PORT}`);
    console.log(`  try: http://localhost:${PORT}/api/v1/search?q=projects`);
    console.log(`       http://localhost:${PORT}/api/v1/health`);
  });
