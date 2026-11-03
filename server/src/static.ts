import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

// Serves the built web app and falls back to index.html for client-side routes.
export async function staticFiles(app: FastifyInstance, root: string) {
  const index = path.join(root, 'index.html');
  const hasBuild = fs.existsSync(index);

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/') || request.method !== 'GET') {
      return reply.code(404).send({ error: 'not_found' });
    }
    if (!hasBuild) {
      return reply.type('text/plain').send('Web app is not built. Run "npm run build" or use "npm run dev".');
    }

    let urlPath = '/';
    try {
      urlPath = decodeURIComponent(request.url.split('?')[0]);
    } catch {
      // Malformed escape sequence: serve the app shell.
    }
    const file = path.join(root, path.normalize(urlPath));
    // path.normalize collapses "../", but check anyway that we never leave root.
    const insideRoot = file.startsWith(root + path.sep);
    const target = insideRoot && fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : index;

    const immutable = target.includes(`${path.sep}assets${path.sep}`);
    return reply
      .type(TYPES[path.extname(target)] ?? 'application/octet-stream')
      .header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
      .send(fs.createReadStream(target));
  });
}
