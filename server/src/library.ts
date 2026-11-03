import type { SQLInputValue } from 'node:sqlite';
import { all, get } from './db.ts';
import { likePattern, sortBy } from './text.ts';

export type Track = {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  album: string;
  albumId: number;
  trackNo: number | null;
  discNo: number | null;
  duration: number;
  hasCover: number;
};

export type Album = {
  id: number;
  title: string;
  year: number | null;
  artist: string;
  artistId: number;
  hasCover: number;
  trackCount: number;
  duration: number;
};

export type Artist = { id: number; name: string; albumCount: number; trackCount: number; coverAlbumId: number | null };

const TRACK_COLUMNS = `
  t.id, t.title, ar.name AS artist, ar.id AS artistId, al.title AS album, al.id AS albumId,
  t.track_no AS trackNo, t.disc_no AS discNo, t.duration, al.cover IS NOT NULL AS hasCover`;

const TRACK_JOINS = `JOIN artists ar ON ar.id = t.artist_id JOIN albums al ON al.id = t.album_id`;

const ALBUM_SELECT = `
  SELECT al.id, al.title, al.year, ar.name AS artist, ar.id AS artistId, al.cover IS NOT NULL AS hasCover,
    COUNT(t.id) AS trackCount, COALESCE(SUM(t.duration), 0) AS duration
  FROM albums al JOIN artists ar ON ar.id = al.artist_id LEFT JOIN tracks t ON t.album_id = al.id`;

export function tracksWhere(where: string, order: string, ...params: SQLInputValue[]): Track[] {
  return all<Track>(`SELECT ${TRACK_COLUMNS} FROM tracks t ${TRACK_JOINS} WHERE ${where} ORDER BY ${order}`, ...params);
}

export function listAlbums(sort: 'name' | 'recent' | 'year' | 'random', limit: number, offset: number): Album[] {
  if (sort === 'name') {
    return sortBy(all<Album>(`${ALBUM_SELECT} GROUP BY al.id`), (a) => a.title).slice(offset, offset + limit);
  }
  const order = { recent: 'al.added_at DESC', year: 'al.year DESC NULLS LAST, al.title', random: 'random()' }[sort];
  return all<Album>(`${ALBUM_SELECT} GROUP BY al.id ORDER BY ${order} LIMIT ? OFFSET ?`, limit, offset);
}

export function getAlbum(id: number) {
  const album = get<Album>(`${ALBUM_SELECT} WHERE al.id = ? GROUP BY al.id`, id);
  if (!album) return null;
  const tracks = tracksWhere('t.album_id = ?', 'COALESCE(t.disc_no, 1), t.track_no NULLS LAST, t.title', id);
  return { ...album, tracks };
}

const ARTIST_SELECT = `
  SELECT ar.id, ar.name,
    (SELECT COUNT(*) FROM albums WHERE artist_id = ar.id) AS albumCount,
    (SELECT COUNT(*) FROM tracks WHERE artist_id = ar.id) AS trackCount,
    (SELECT id FROM albums WHERE artist_id = ar.id AND cover IS NOT NULL ORDER BY year DESC LIMIT 1) AS coverAlbumId
  FROM artists ar`;

export function listArtists(): Artist[] {
  return sortBy(all<Artist>(ARTIST_SELECT), (a) => a.name);
}

export function getArtist(id: number) {
  const artist = get<Artist>(`${ARTIST_SELECT} WHERE ar.id = ?`, id);
  if (!artist) return null;
  const albums = all<Album>(`${ALBUM_SELECT} WHERE al.artist_id = ? GROUP BY al.id ORDER BY al.year DESC NULLS LAST`, id);
  // Tracks this artist appears on in other artists' albums (features, compilations).
  const appearsOn = all<Album>(
    `${ALBUM_SELECT} WHERE al.artist_id != ? AND al.id IN (SELECT album_id FROM tracks WHERE artist_id = ?)
     GROUP BY al.id ORDER BY al.year DESC NULLS LAST`,
    id,
    id,
  );
  const topTracks = tracksWhere(
    't.artist_id = ?',
    '(SELECT COUNT(*) FROM plays p WHERE p.track_id = t.id) DESC, t.title LIMIT 10',
    id,
  );
  return { ...artist, albums, appearsOn, topTracks };
}

export function search(query: string) {
  const pattern = likePattern(query);
  return {
    artists: all<Artist>(`${ARTIST_SELECT} WHERE ar.search LIKE ? ESCAPE '\\' LIMIT 8`, pattern),
    albums: all<Album>(`${ALBUM_SELECT} WHERE al.search LIKE ? ESCAPE '\\' GROUP BY al.id LIMIT 12`, pattern),
    tracks: tracksWhere(`t.search LIKE ? ESCAPE '\\'`, 't.title LIMIT 50', pattern),
  };
}

export function home(userId: number) {
  return {
    recentlyAdded: listAlbums('recent', 12, 0),
    recentlyPlayed: tracksWhere(
      't.id IN (SELECT track_id FROM plays WHERE user_id = ? GROUP BY track_id ORDER BY MAX(played_at) DESC LIMIT 12)',
      '(SELECT MAX(played_at) FROM plays WHERE user_id = ? AND track_id = t.id) DESC',
      userId,
      userId,
    ),
    mostPlayed: tracksWhere(
      't.id IN (SELECT track_id FROM plays WHERE user_id = ? GROUP BY track_id ORDER BY COUNT(*) DESC LIMIT 10)',
      '(SELECT COUNT(*) FROM plays WHERE user_id = ? AND track_id = t.id) DESC',
      userId,
      userId,
    ),
    discover: listAlbums('random', 12, 0),
  };
}

export function stats() {
  return get<{ tracks: number; albums: number; artists: number; duration: number; size: number }>(
    `SELECT (SELECT COUNT(*) FROM tracks) AS tracks, (SELECT COUNT(*) FROM albums) AS albums,
      (SELECT COUNT(*) FROM artists) AS artists, COALESCE((SELECT SUM(duration) FROM tracks), 0) AS duration,
      COALESCE((SELECT SUM(size) FROM tracks), 0) AS size`,
  )!;
}
