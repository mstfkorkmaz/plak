import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { get } from '../db.ts';
import { parseRange } from '../range.ts';
import { coversDir } from '../scanner.ts';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

const COVER_MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export async function mediaRoutes(app: FastifyInstance) {
  // Range requests let the browser seek and start playback before the whole file arrives.
  app.get<{ Params: { id: number } }>('/api/stream/:id', { schema: { params: idParams } }, async (request, reply) => {
    const track = get<{ path: string; mime: string }>('SELECT path, mime FROM tracks WHERE id = ?', request.params.id);
    if (!track) return reply.code(404).send({ error: 'not_found' });

    let size: number;
    try {
      size = (await fs.promises.stat(track.path)).size;
    } catch {
      return reply.code(404).send({ error: 'file_missing' });
    }

    reply
      .header('Accept-Ranges', 'bytes')
      .header('Content-Type', track.mime)
      .header('Cache-Control', 'private, max-age=86400');

    const range = parseRange(request.headers.range, size);
    if (range === 'invalid') {
      return reply.code(416).header('Content-Range', `bytes */${size}`).send();
    }
    if (range) {
      reply
        .code(206)
        .header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
        .header('Content-Length', range.end - range.start + 1);
      return reply.send(fs.createReadStream(track.path, range));
    }
    reply.header('Content-Length', size);
    return reply.send(fs.createReadStream(track.path));
  });

  app.get<{ Params: { id: number } }>('/api/covers/:id', { schema: { params: idParams } }, async (request, reply) => {
    const album = get<{ cover: string | null }>('SELECT cover FROM albums WHERE id = ?', request.params.id);
    if (!album?.cover) return reply.code(404).send({ error: 'not_found' });
    reply
      .header('Content-Type', COVER_MIME[path.extname(album.cover)] ?? 'application/octet-stream')
      .header('Cache-Control', 'private, max-age=604800');
    return reply.send(fs.createReadStream(path.join(coversDir, album.cover)));
  });
}
