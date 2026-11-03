import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, type PlaylistSummary, type Track } from '../api';
import { useI18n } from '../i18n';
import { useToast } from '../toast';
import { Icon } from './Icon';
import { Cover } from './ui';

const PickerContext = createContext<(tracks: Track[]) => void>(() => {});

export function PlaylistPickerProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  return (
    <PickerContext.Provider value={setTracks}>
      {children}
      {tracks && <PlaylistPicker tracks={tracks} onClose={() => setTracks(null)} />}
    </PickerContext.Provider>
  );
}

export const usePlaylistPicker = () => useContext(PickerContext);

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function PlaylistPicker({ tracks, onClose }: { tracks: Track[]; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    api<PlaylistSummary[]>('/playlists').then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  const done = useCallback(
    (playlistName: string) => {
      toast(`${t.added}: ${playlistName}`);
      window.dispatchEvent(new Event('plak:playlists-changed'));
      onClose();
    },
    [toast, t, onClose],
  );

  async function addTo(playlist: PlaylistSummary) {
    await api(`/playlists/${playlist.id}/tracks`, { method: 'POST', body: { trackIds: tracks.map((x) => x.id) } });
    done(playlist.name);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await api('/playlists', { method: 'POST', body: { name, trackIds: tracks.map((x) => x.id) } });
    done(name.trim());
  }

  return (
    <Modal title={t.addToPlaylist} onClose={onClose}>
      <form className="inline-form" onSubmit={create}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.newPlaylist}
          aria-label={t.playlistName}
          maxLength={100}
        />
        <button className="button" disabled={!name.trim()}>
          {t.create}
        </button>
      </form>
      <ul className="picker-list">
        {playlists?.map((playlist) => (
          <li key={playlist.id}>
            <button type="button" onClick={() => addTo(playlist)}>
              <Cover albumId={playlist.coverAlbumId} hasCover={Boolean(playlist.coverAlbumId)} />
              <span>
                <strong>{playlist.name}</strong>
                <small>{t.songs(playlist.trackCount)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
