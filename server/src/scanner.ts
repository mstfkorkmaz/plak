import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile, type IPicture } from 'music-metadata';
import { config } from './config.ts';
import { all, get, run, transaction } from './db.ts';
import { fold } from './text.ts';

// Only formats every modern browser can play without transcoding.
const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
};

const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart'];
const COVER_TYPES: Record<string, string> = { '.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.webp': 'webp' };

export const UNKNOWN_ARTIST = 'Unknown Artist';

export type ScanStatus = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  seen: number;
  added: number;
  updated: number;
  removed: number;
  errors: number;
  lastError: string | null;
};

export const scanStatus: ScanStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  seen: 0,
  added: 0,
  updated: 0,
  removed: 0,
  errors: 0,
  lastError: null,
};

export const coversDir = path.join(config.dataDir, 'covers');

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() in AUDIO_TYPES) yield full;
  }
}

function upsertArtist(name: string): number {
  const found = get<{ id: number }>('SELECT id FROM artists WHERE name = ?', name);
  if (found) return found.id;
  return Number(run('INSERT INTO artists (name, search) VALUES (?, ?)', name, fold(name)).lastInsertRowid);
}

function upsertAlbum(title: string, artistId: number, artistName: string, year: number | null, folder: string): number {
  const found = get<{ id: number; year: number | null }>(
    'SELECT id, year FROM albums WHERE title = ? AND artist_id = ?',
    title,
    artistId,
  );
  if (found) {
    if (found.year === null && year !== null) run('UPDATE albums SET year = ? WHERE id = ?', year, found.id);
    return found.id;
  }
  return Number(
    run(
      'INSERT INTO albums (title, artist_id, year, folder, added_at, search) VALUES (?, ?, ?, ?, ?, ?)',
      title,
      artistId,
      year,
      folder,
      Date.now(),
      fold(`${title} ${artistName}`),
    ).lastInsertRowid,
  );
}

async function findFolderCover(folder: string): Promise<string | null> {
  let names: string[];
  try {
    names = await fs.readdir(folder);
  } catch {
    return null;
  }
  for (const wanted of COVER_NAMES) {
    const match = names.find((name) => {
      const ext = path.extname(name).toLowerCase();
      return ext in COVER_TYPES && path.basename(name, path.extname(name)).toLowerCase() === wanted;
    });
    if (match) return path.join(folder, match);
  }
  return null;
}

async function saveCover(albumId: number, folder: string, picture: IPicture | undefined): Promise<void> {
  const current = get<{ cover: string | null }>('SELECT cover FROM albums WHERE id = ?', albumId);
  if (!current || current.cover) return;

  await fs.mkdir(coversDir, { recursive: true });
  const folderCover = await findFolderCover(folder);
  let fileName: string | null = null;

  if (folderCover) {
    fileName = `${albumId}.${COVER_TYPES[path.extname(folderCover).toLowerCase()]}`;
    await fs.copyFile(folderCover, path.join(coversDir, fileName));
  } else if (picture) {
    const ext = picture.format.includes('png') ? 'png' : picture.format.includes('webp') ? 'webp' : 'jpg';
    fileName = `${albumId}.${ext}`;
    await fs.writeFile(path.join(coversDir, fileName), picture.data);
  }

  if (fileName) run('UPDATE albums SET cover = ? WHERE id = ?', fileName, albumId);
}

async function indexFile(file: string, scanId: number): Promise<void> {
  const stat = await fs.stat(file);
  const mtime = Math.floor(stat.mtimeMs);
  const existing = get<{ id: number; size: number; mtime: number }>(
    'SELECT id, size, mtime FROM tracks WHERE path = ?',
    file,
  );

  // Mark as seen before parsing, so a file that fails to parse is not deleted.
  if (existing) {
    run('UPDATE tracks SET scan_id = ? WHERE id = ?', scanId, existing.id);
    if (existing.size === stat.size && existing.mtime === mtime) return;
  }

  const { common, format } = await parseFile(file);
  const ext = path.extname(file).toLowerCase();
  const folder = path.dirname(file);

  const title = common.title?.trim() || path.basename(file, ext);
  const artistName = common.artist?.trim() || common.albumartist?.trim() || UNKNOWN_ARTIST;
  const albumArtistName = common.albumartist?.trim() || artistName;
  const albumTitle = common.album?.trim() || path.basename(folder);
  const year = common.year ?? null;

  const albumId = transaction(() => {
    const artistId = upsertArtist(artistName);
    const albumArtistId = albumArtistName === artistName ? artistId : upsertArtist(albumArtistName);
    const albumId = upsertAlbum(albumTitle, albumArtistId, albumArtistName, year, folder);
    const values = [
      title,
      artistId,
      albumId,
      common.track.no ?? null,
      common.disk.no ?? null,
      year,
      common.genre?.[0] ?? null,
      format.duration ?? 0,
      format.bitrate ? Math.round(format.bitrate / 1000) : null,
      format.codec ?? null,
      AUDIO_TYPES[ext],
      stat.size,
      mtime,
      scanId,
      fold(`${title} ${artistName} ${albumTitle}`),
    ];

    if (existing) {
      run(
        `UPDATE tracks SET title = ?, artist_id = ?, album_id = ?, track_no = ?, disc_no = ?, year = ?, genre = ?,
         duration = ?, bitrate = ?, codec = ?, mime = ?, size = ?, mtime = ?, scan_id = ?, search = ? WHERE id = ?`,
        ...values,
        existing.id,
      );
      scanStatus.updated++;
    } else {
      run(
        `INSERT INTO tracks (title, artist_id, album_id, track_no, disc_no, year, genre, duration, bitrate, codec,
         mime, size, mtime, scan_id, search, path, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...values,
        file,
        Date.now(),
      );
      scanStatus.added++;
    }
    return albumId;
  });

  await saveCover(albumId, folder, common.picture?.[0]);
}

async function removeMissing(scanId: number): Promise<number> {
  const orphanCovers = transaction(() => {
    const removed = Number(run('DELETE FROM tracks WHERE scan_id != ?', scanId).changes);
    scanStatus.removed = removed;
    const covers = all<{ cover: string }>(
      'SELECT cover FROM albums WHERE cover IS NOT NULL AND id NOT IN (SELECT album_id FROM tracks)',
    );
    run('DELETE FROM albums WHERE id NOT IN (SELECT album_id FROM tracks)');
    run(
      `DELETE FROM artists WHERE id NOT IN (SELECT artist_id FROM tracks)
       AND id NOT IN (SELECT artist_id FROM albums)`,
    );
    return covers;
  });
  await Promise.all(orphanCovers.map(({ cover }) => fs.rm(path.join(coversDir, cover), { force: true })));
  return scanStatus.removed;
}

export async function scanLibrary(): Promise<ScanStatus> {
  if (scanStatus.running) return scanStatus;
  Object.assign(scanStatus, {
    running: true,
    startedAt: Date.now(),
    finishedAt: null,
    seen: 0,
    added: 0,
    updated: 0,
    removed: 0,
    errors: 0,
    lastError: null,
  });

  const scanId = Date.now();
  try {
    await fs.mkdir(config.musicDir, { recursive: true });
    for await (const file of walk(config.musicDir)) {
      scanStatus.seen++;
      try {
        await indexFile(file, scanId);
      } catch (error) {
        scanStatus.errors++;
        scanStatus.lastError = `${path.relative(config.musicDir, file)}: ${(error as Error).message}`;
      }
    }

    // An unplugged drive looks exactly like an empty library. Deleting
    // everything would also wipe playlists and favorites, so refuse.
    const known = get<{ n: number }>('SELECT COUNT(*) AS n FROM tracks')!.n;
    if (scanStatus.seen === 0 && known > 0) {
      scanStatus.lastError = 'Music folder is empty or unreachable; kept the existing library.';
    } else {
      await removeMissing(scanId);
    }
  } finally {
    scanStatus.running = false;
    scanStatus.finishedAt = Date.now();
  }
  return scanStatus;
}
