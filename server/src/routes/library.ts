import type { FastifyInstance } from 'fastify';
import { all, run } from '../db.ts';
import { getAlbum, getArtist, home, listAlbums, listArtists, search, stats, tracksWhere } from '../library.ts';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

type IdParams = { id: number };

export async function libraryRoutes(app: FastifyInstance) {
  app.get('/api/home', async (request) => home(request.user!.id));

  app.get('/api/stats', async () => stats());

  app.get<{ Querystring: { sort: 'name' | 'recent' | 'year' | 'random'; limit: number; offset: number } }>(
    '/api/albums',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            sort: { type: 'string', enum: ['name', 'recent', 'year', 'random'], default: 'name' },
            limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => listAlbums(request.query.sort, request.query.limit, request.query.offset),
  );

  app.get<{ Params: IdParams }>('/api/albums/:id', { schema: { params: idParams } }, async (request, reply) => {
    return getAlbum(request.params.id) ?? reply.code(404).send({ error: 'not_found' });
  });

  app.get('/api/artists', async () => listArtists());

  app.get<{ Params: IdParams }>('/api/artists/:id', { schema: { params: idParams } }, async (request, reply) => {
    return getArtist(request.params.id) ?? reply.code(404).send({ error: 'not_found' });
  });

  app.get<{ Querystring: { q: string } }>(
    '/api/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: { q: { type: 'string', minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request) => search(request.query.q),
  );

  app.get('/api/favorites', async (request) =>
    tracksWhere(
      't.id IN (SELECT track_id FROM favorites WHERE user_id = ?)',
      '(SELECT created_at FROM favorites WHERE user_id = ? AND track_id = t.id) DESC',
      request.user!.id,
      request.user!.id,
    ),
  );

  app.get('/api/favorites/ids', async (request) =>
    all<{ track_id: number }>('SELECT track_id FROM favorites WHERE user_id = ?', request.user!.id).map((r) => r.track_id),
  );

  app.put<{ Params: IdParams }>('/api/favorites/:id', { schema: { params: idParams } }, async (request) => {
    run(
      'INSERT OR IGNORE INTO favorites (user_id, track_id, created_at) SELECT ?, id, ? FROM tracks WHERE id = ?',
      request.user!.id,
      Date.now(),
      request.params.id,
    );
    return { ok: true };
  });

  app.delete<{ Params: IdParams }>('/api/favorites/:id', { schema: { params: idParams } }, async (request) => {
    run('DELETE FROM favorites WHERE user_id = ? AND track_id = ?', request.user!.id, request.params.id);
    return { ok: true };
  });

  // The player reports a play once a track has been listened to for a while.
  app.post<{ Params: IdParams }>('/api/plays/:id', { schema: { params: idParams } }, async (request) => {
    run(
      'INSERT INTO plays (user_id, track_id, played_at) SELECT ?, id, ? FROM tracks WHERE id = ?',
      request.user!.id,
      Date.now(),
      request.params.id,
    );
    return { ok: true };
  });
}
