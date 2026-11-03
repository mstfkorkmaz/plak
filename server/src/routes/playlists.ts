import type { FastifyInstance, FastifyReply } from 'fastify';
import { all, get, run, transaction } from '../db.ts';
import { tracksWhere } from '../library.ts';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

const trackIds = { type: 'array', maxItems: 5000, items: { type: 'integer', minimum: 1 } } as const;
const name = { type: 'string', minLength: 1, maxLength: 100 } as const;

type IdParams = { id: number };

function owned(playlistId: number, userId: number, reply: FastifyReply): boolean {
  const found = get('SELECT 1 FROM playlists WHERE id = ? AND user_id = ?', playlistId, userId);
  if (!found) reply.code(404).send({ error: 'not_found' });
  return Boolean(found);
}

function setTracks(playlistId: number, ids: number[], startAt = 0): void {
  ids.forEach((trackId, index) => {
    run(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) SELECT ?, id, ? FROM tracks WHERE id = ?',
      playlistId,
      startAt + index,
      trackId,
    );
  });
  run('UPDATE playlists SET updated_at = ? WHERE id = ?', Date.now(), playlistId);
}

export async function playlistRoutes(app: FastifyInstance) {
  app.get('/api/playlists', async (request) =>
    all(
      `SELECT p.id, p.name, p.updated_at AS updatedAt, COUNT(pt.track_id) AS trackCount,
        (SELECT t.album_id FROM playlist_tracks x JOIN tracks t ON t.id = x.track_id JOIN albums a ON a.id = t.album_id
         WHERE x.playlist_id = p.id AND a.cover IS NOT NULL ORDER BY x.position LIMIT 1) AS coverAlbumId
       FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       WHERE p.user_id = ? GROUP BY p.id ORDER BY p.updated_at DESC`,
      request.user!.id,
    ),
  );

  app.post<{ Body: { name: string; trackIds?: number[] } }>(
    '/api/playlists',
    { schema: { body: { type: 'object', required: ['name'], properties: { name, trackIds } } } },
    async (request) => {
      const now = Date.now();
      return transaction(() => {
        const id = Number(
          run(
            'INSERT INTO playlists (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
            request.user!.id,
            request.body.name.trim(),
            now,
            now,
          ).lastInsertRowid,
        );
        setTracks(id, request.body.trackIds ?? []);
        return { id };
      });
    },
  );

  app.get<{ Params: IdParams }>('/api/playlists/:id', { schema: { params: idParams } }, async (request, reply) => {
    const playlist = get<{ id: number; name: string; updatedAt: number }>(
      'SELECT id, name, updated_at AS updatedAt FROM playlists WHERE id = ? AND user_id = ?',
      request.params.id,
      request.user!.id,
    );
    if (!playlist) return reply.code(404).send({ error: 'not_found' });
    const tracks = tracksWhere(
      't.id IN (SELECT track_id FROM playlist_tracks WHERE playlist_id = ?)',
      '1',
      playlist.id,
    );
    // A track may appear more than once, so rebuild the order from positions.
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const order = all<{ track_id: number }>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position',
      playlist.id,
    );
    return { ...playlist, tracks: order.map((row) => byId.get(row.track_id)!).filter(Boolean) };
  });

  // Rename and/or replace the whole track list (used for reordering and removing).
  app.put<{ Params: IdParams; Body: { name?: string; trackIds?: number[] } }>(
    '/api/playlists/:id',
    { schema: { params: idParams, body: { type: 'object', properties: { name, trackIds } } } },
    async (request, reply) => {
      if (!owned(request.params.id, request.user!.id, reply)) return reply;
      transaction(() => {
        if (request.body.name) {
          run('UPDATE playlists SET name = ? WHERE id = ?', request.body.name.trim(), request.params.id);
        }
        if (request.body.trackIds) {
          run('DELETE FROM playlist_tracks WHERE playlist_id = ?', request.params.id);
          setTracks(request.params.id, request.body.trackIds);
        }
      });
      return { ok: true };
    },
  );

  app.post<{ Params: IdParams; Body: { trackIds: number[] } }>(
    '/api/playlists/:id/tracks',
    { schema: { params: idParams, body: { type: 'object', required: ['trackIds'], properties: { trackIds } } } },
    async (request, reply) => {
      if (!owned(request.params.id, request.user!.id, reply)) return reply;
      transaction(() => {
        const { next } = get<{ next: number }>(
          'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM playlist_tracks WHERE playlist_id = ?',
          request.params.id,
        )!;
        setTracks(request.params.id, request.body.trackIds, next);
      });
      return { ok: true };
    },
  );

  app.delete<{ Params: IdParams }>('/api/playlists/:id', { schema: { params: idParams } }, async (request, reply) => {
    if (!owned(request.params.id, request.user!.id, reply)) return reply;
    run('DELETE FROM playlists WHERE id = ?', request.params.id);
    return { ok: true };
  });
}
