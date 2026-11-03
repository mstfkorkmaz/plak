import { useCallback, useEffect, useState } from 'react';

export type User = { id: number; username: string; isAdmin: boolean };

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

export type AlbumDetail = Album & { tracks: Track[] };

export type Artist = { id: number; name: string; albumCount: number; trackCount: number; coverAlbumId: number | null };

export type ArtistDetail = Artist & { albums: Album[]; appearsOn: Album[]; topTracks: Track[] };

export type PlaylistSummary = { id: number; name: string; trackCount: number; coverAlbumId: number | null };

export type Playlist = { id: number; name: string; tracks: Track[] };

export class ApiError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('plak:unauthorized'));
    throw new ApiError(response.status, data.error ?? 'request_failed');
  }
  return data as T;
}

export const coverUrl = (albumId: number) => `/api/covers/${albumId}`;
export const streamUrl = (trackId: number) => `/api/stream/${trackId}`;

// Loads `path` and reloads whenever it changes. Pass null to skip loading.
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setError(null);
    api<T>(path)
      .then((result) => !cancelled && setData(result))
      .catch((err: ApiError) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload, setData };
}
