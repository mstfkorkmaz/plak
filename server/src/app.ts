import Fastify from 'fastify';
import { sessionUser, type User } from './auth.ts';
import { config } from './config.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { libraryRoutes } from './routes/library.ts';
import { mediaRoutes } from './routes/media.ts';
import { playlistRoutes } from './routes/playlists.ts';
import { staticFiles } from './static.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

const PUBLIC_ROUTES = new Set(['/api/auth/state', '/api/auth/setup', '/api/auth/login', '/api/auth/logout']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: config.trustProxy });

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    reply.headers(SECURITY_HEADERS);
    if (!request.url.startsWith('/api/')) return;
    request.user = sessionUser(request);
    const route = request.url.split('?')[0];
    if (!request.user && !PUBLIC_ROUTES.has(route)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  await app.register(authRoutes);
  await app.register(libraryRoutes);
  await app.register(playlistRoutes);
  await app.register(mediaRoutes);
  await app.register(adminRoutes);
  await staticFiles(app, config.webDir);

  return app;
}
