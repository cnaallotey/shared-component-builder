// Minimal static server for previewing site/ locally: `npm run site:serve`.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

async function resolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const file = normalize(join(siteDir, decoded));
  if (file !== siteDir && !file.startsWith(siteDir + sep)) return null;
  try {
    const info = await stat(file);
    if (info.isDirectory()) return resolve(join(decoded, 'index.html'));
    return file;
  } catch {
    // Match Cloudflare Pages: /docs/api serves /docs/api.html
    if (!extname(file)) return resolve(`${decoded}.html`).catch(() => null);
    return null;
  }
}

createServer(async (req, res) => {
  const file = await resolve(req.url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    res.end(await readFile(join(siteDir, '404.html')).catch(() => 'Not found'));
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving site/ at http://localhost:${port}`);
});
