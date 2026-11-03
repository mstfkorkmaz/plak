import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.ts';
import { get, run } from './db.ts';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'plak_session';

export type User = { id: number; username: string; isAdmin: boolean };

// Passwords are stored as "scrypt$<salt>$<hash>". scrypt is deliberately slow
// and memory-hungry, which makes offline guessing of a stolen database expensive.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Only a hash of the session token is stored, so a leaked database
// cannot be used to log in as anyone.
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + config.sessionDays * 86_400_000;
  run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', tokenHash(token), userId, expiresAt);
  run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return token;
}

export function deleteSession(token: string): void {
  run('DELETE FROM sessions WHERE token_hash = ?', tokenHash(token));
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

export function sessionUser(request: FastifyRequest): User | null {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  const row = get<{ id: number; username: string; is_admin: number }>(
    `SELECT u.id, u.username, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    tokenHash(token),
    Date.now(),
  );
  return row ? { id: row.id, username: row.username, isAdmin: row.is_admin === 1 } : null;
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, token: string | null): void {
  const parts = [
    `${SESSION_COOKIE}=${token ?? ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${token ? config.sessionDays * 86_400 : 0}`,
  ];
  if (request.protocol === 'https') parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

// Slows down password guessing: at most 5 failed logins per IP per 15 minutes.
const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

export function isLockedOut(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(ip: string): void {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt < Date.now()) failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else entry.count++;
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
}
