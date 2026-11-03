import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../auth.ts';
import { config } from '../config.ts';
import { all, get, run } from '../db.ts';
import { scanLibrary, scanStatus } from '../scanner.ts';
import { credentialsSchema } from './auth.ts';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.user?.isAdmin) return reply.code(403).send({ error: 'forbidden' });
  });

  app.get('/api/admin/scan', async () => ({ ...scanStatus, musicDir: config.musicDir }));

  app.post('/api/admin/scan', async () => {
    // Fire and forget: the client polls GET /api/admin/scan for progress.
    void scanLibrary();
    return { ...scanStatus, running: true };
  });

  app.get('/api/admin/users', async () =>
    all(
      'SELECT id, username, is_admin = 1 AS isAdmin, created_at AS createdAt FROM users ORDER BY created_at',
    ),
  );

  app.post<{ Body: { username: string; password: string; isAdmin?: boolean } }>(
    '/api/admin/users',
    {
      schema: {
        body: {
          ...credentialsSchema,
          properties: { ...credentialsSchema.properties, isAdmin: { type: 'boolean' } },
        },
      },
    },
    async (request, reply) => {
      const { username, password, isAdmin } = request.body;
      if (get('SELECT 1 FROM users WHERE username = ?', username)) {
        return reply.code(409).send({ error: 'username_taken' });
      }
      const id = run(
        'INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)',
        username,
        await hashPassword(password),
        isAdmin ? 1 : 0,
        Date.now(),
      ).lastInsertRowid;
      return { id: Number(id) };
    },
  );

  app.delete<{ Params: { id: number } }>(
    '/api/admin/users/:id',
    { schema: { params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } } } } },
    async (request, reply) => {
      if (request.params.id === request.user!.id) return reply.code(400).send({ error: 'cannot_delete_self' });
      run('DELETE FROM users WHERE id = ?', request.params.id);
      return { ok: true };
    },
  );
}
