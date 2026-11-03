import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

// config.ts reads the environment on import, so point it at a throwaway
// folder before loading the app.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'plak-test-'));
process.env.PLAK_DATA_DIR = path.join(temp, 'data');
process.env.PLAK_MUSIC_DIR = path.join(temp, 'music');

const root = path.resolve(import.meta.dirname, '../..');
execFileSync(process.execPath, [path.join(root, 'scripts/demo-library.mjs'), process.env.PLAK_MUSIC_DIR]);

const { buildApp } = await import('../src/app.ts');
const { scanLibrary } = await import('../src/scanner.ts');
const { db } = await import('../src/db.ts');

const app = await buildApp();
let cookie = '';

async function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, headers = {}) {
  return app.inject({ method, url, payload, headers: { cookie, ...headers } });
}

before(async () => {
  await scanLibrary();
});

after(async () => {
  await app.close();
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

test('library endpoints require a session', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/albums' });
  assert.equal(response.statusCode, 401);
});

test('first user is created through setup and becomes admin', async () => {
  const state = await api('GET', '/api/auth/state');
  assert.equal(state.json().needsSetup, true);

  const weak = await api('POST', '/api/auth/setup', { username: 'admin', password: 'short' });
  assert.equal(weak.statusCode, 400);

  const setup = await api('POST', '/api/auth/setup', { username: 'admin', password: 'correct horse' });
  assert.equal(setup.statusCode, 200);
  assert.equal(setup.json().user.isAdmin, true);
  cookie = String(setup.headers['set-cookie']).split(';')[0];

  const again = await api('POST', '/api/auth/setup', { username: 'other', password: 'correct horse' });
  assert.equal(again.statusCode, 409);
});

test('wrong password is rejected', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'wrong password' },
  });
  assert.equal(response.statusCode, 401);
});

test('scanner indexed the demo library with covers', async () => {
  const stats = (await api('GET', '/api/stats')).json();
  assert.equal(stats.tracks, 12);
  assert.equal(stats.albums, 3);
  assert.equal(stats.artists, 3);

  const albums = (await api('GET', '/api/albums?sort=name')).json();
  assert.deepEqual(
    albums.map((a: { title: string }) => a.title),
    ['Ege Rüzgârı', 'İstasyon Işıkları', 'Neon Lines'],
  );
  assert.ok(albums.every((a: { hasCover: number }) => a.hasCover));

  const cover = await api('GET', `/api/covers/${albums[0].id}`);
  assert.equal(cover.statusCode, 200);
  assert.equal(cover.headers['content-type'], 'image/png');

  const album = (await api('GET', `/api/albums/${albums[1].id}`)).json();
  assert.deepEqual(
    album.tracks.map((t: { title: string }) => t.title),
    ['Son Vapur', 'Şehir Uyurken', 'Kırık Saat', 'Gölgeler'],
  );
});

test('search ignores Turkish characters and case', async () => {
  const result = (await api('GET', `/api/search?q=${encodeURIComponent('sehir uyurken')}`)).json();
  assert.equal(result.tracks[0].title, 'Şehir Uyurken');
  const byAlbum = (await api('GET', '/api/search?q=ISTASYON')).json();
  assert.equal(byAlbum.albums[0].title, 'İstasyon Işıkları');
});

test('stream supports range requests', async () => {
  const track = (await api('GET', '/api/search?q=dalga')).json().tracks[0];
  const full = await api('GET', `/api/stream/${track.id}`);
  assert.equal(full.statusCode, 200);
  assert.equal(full.headers['content-type'], 'audio/wav');

  const partial = await api('GET', `/api/stream/${track.id}`, undefined, { range: 'bytes=0-99' });
  assert.equal(partial.statusCode, 206);
  assert.equal(partial.rawPayload.length, 100);
  assert.match(String(partial.headers['content-range']), /^bytes 0-99\/\d+$/);
});

test('playlists keep order and belong to their owner', async () => {
  const tracks = (await api('GET', '/api/search?q=neon')).json().tracks.slice(0, 3);
  const ids = tracks.map((t: { id: number }) => t.id).reverse();
  const { id } = (await api('POST', '/api/playlists', { name: 'Yol', trackIds: ids })).json();

  await api('POST', `/api/playlists/${id}/tracks`, { trackIds: [ids[0]] });
  const playlist = (await api('GET', `/api/playlists/${id}`)).json();
  assert.deepEqual(
    playlist.tracks.map((t: { id: number }) => t.id),
    [...ids, ids[0]],
  );

  await api('POST', '/api/admin/users', { username: 'misafir', password: 'another password' });
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'misafir', password: 'another password' },
  });
  const guest = String(login.headers['set-cookie']).split(';')[0];
  const foreign = await app.inject({ method: 'GET', url: `/api/playlists/${id}`, headers: { cookie: guest } });
  assert.equal(foreign.statusCode, 404);
  const adminOnly = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: guest } });
  assert.equal(adminOnly.statusCode, 403);
});

test('rescan keeps the library when the music folder disappears', async () => {
  fs.renameSync(process.env.PLAK_MUSIC_DIR!, `${process.env.PLAK_MUSIC_DIR}-moved`);
  const status = await scanLibrary();
  assert.equal(status.seen, 0);
  assert.ok(status.lastError);
  assert.equal((await api('GET', '/api/stats')).json().tracks, 12);
});
