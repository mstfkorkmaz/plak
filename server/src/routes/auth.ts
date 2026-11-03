import type { FastifyInstance } from 'fastify';
import {
  clearFailures,
  createSession,
  deleteSession,
  hashPassword,
  isLockedOut,
  readCookie,
  recordFailure,
  SESSION_COOKIE,
  sessionUser,
  setSessionCookie,
  verifyPassword,
} from '../auth.ts';
import { get, run } from '../db.ts';

export const credentialsSchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 2, maxLength: 32, pattern: '^[\\p{L}\\p{N}._-]+$' },
    password: { type: 'string', minLength: 8, maxLength: 200 },
  },
} as const;

type Credentials = { username: string; password: string };

function userCount(): number {
  return get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n;
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/state', async (request) => ({
    needsSetup: userCount() === 0,
    user: sessionUser(request),
  }));

  // The very first account is created from the browser and becomes the admin.
  app.post<{ Body: Credentials }>('/api/auth/setup', { schema: { body: credentialsSchema } }, async (request, reply) => {
    if (userCount() > 0) return reply.code(409).send({ error: 'already_set_up' });
    const { username, password } = request.body;
    const id = Number(
      run(
        'INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 1, ?)',
        username,
        await hashPassword(password),
        Date.now(),
      ).lastInsertRowid,
    );
    setSessionCookie(request, reply, createSession(id));
    return { user: { id, username, isAdmin: true } };
  });

  app.post<{ Body: Credentials }>(
    '/api/auth/login',
    { schema: { body: { ...credentialsSchema, properties: { username: { type: 'string' }, password: { type: 'string' } } } } },
    async (request, reply) => {
      if (isLockedOut(request.ip)) return reply.code(429).send({ error: 'too_many_attempts' });
      const { username, password } = request.body;
      const row = get<{ id: number; username: string; password_hash: string; is_admin: number }>(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
        username,
      );
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        recordFailure(request.ip);
        return reply.code(401).send({ error: 'invalid_credentials' });
      }
      clearFailures(request.ip);
      setSessionCookie(request, reply, createSession(row.id));
      return { user: { id: row.id, username: row.username, isAdmin: row.is_admin === 1 } };
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token) deleteSession(token);
    setSessionCookie(request, reply, null);
    return { ok: true };
  });

  app.post<{ Body: { current: string; next: string } }>(
    '/api/auth/password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['current', 'next'],
          properties: { current: { type: 'string' }, next: credentialsSchema.properties.password },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id)!;
      if (!(await verifyPassword(request.body.current, row.password_hash))) {
        return reply.code(403).send({ error: 'wrong_password' });
      }
      run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(request.body.next), user.id);
      // Sign out every other device.
      run('DELETE FROM sessions WHERE user_id = ?', user.id);
      setSessionCookie(request, reply, createSession(user.id));
      return { ok: true };
    },
  );
}
