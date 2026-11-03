import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function dir(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw ? path.resolve(raw) : path.join(root, fallback);
}

export const config = {
  musicDir: dir('PLAK_MUSIC_DIR', 'music'),
  dataDir: dir('PLAK_DATA_DIR', 'data'),
  webDir: path.join(root, 'web', 'dist'),
  host: process.env.PLAK_HOST || '0.0.0.0',
  port: number('PLAK_PORT', 4747),
  // 0 disables the periodic rescan.
  scanIntervalMinutes: number('PLAK_SCAN_INTERVAL', 60),
  sessionDays: number('PLAK_SESSION_DAYS', 30),
  trustProxy: process.env.PLAK_TRUST_PROXY === 'true',
};
