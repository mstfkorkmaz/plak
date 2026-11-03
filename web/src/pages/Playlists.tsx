import { useEffect, useState, type FormEvent } from 'react';
import { api, useApi, type Playlist, type PlaylistSummary, type Track } from '../api';
import { Grid, PlaylistCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { Modal } from '../components/PlaylistPicker';
import { TrackList } from '../components/TrackList';
import { Cover, Empty, ErrorState, Loading } from '../components/ui';
import { formatLongDuration, useI18n } from '../i18n';
import { useFavorites } from '../favorites';
import { usePlayer } from '../player';
import { navigate } from '../router';
import { PlayActions } from './Albums';

const changed = () => window.dispatchEvent(new Event('plak:playlists-changed'));

function NameDialog({ title, initial = '', onSave, onClose }: { title: string; initial?: string; onSave: (name: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.playlistName} autoFocus maxLength={100} />
        <div className="row-end">
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="button" disabled={!name.trim()}>
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Playlists() {
  const { t } = useI18n();
  const { data, error, reload } = useApi<PlaylistSummary[]>('/playlists');
  const [creating, setCreating] = useState(false);

  async function create(name: string) {
    const { id } = await api<{ id: number }>('/playlists', { method: 'POST', body: { name } });
    changed();
    navigate('playlist', id);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t.playlists}</h1>
        <button type="button" className="button" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> {t.newPlaylist}
        </button>
      </div>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty icon="playlist" title={t.noPlaylists} />
      ) : (
        <Grid>
          {data.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </Grid>
      )}
      {creating && <NameDialog title={t.newPlaylist} onSave={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function PlaylistPage({ id }: { id: string }) {
  const { t, language } = useI18n();
  const player = usePlayer();
  const { data, error, reload, setData } = useApi<Playlist>(`/playlists/${id}`);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    window.addEventListener('plak:playlists-changed', reload);
    return () => window.removeEventListener('plak:playlists-changed', reload);
  }, [reload]);

  if (error) return <ErrorState onRetry={reload} notFound={error.status === 404 || error.status === 400} />;
  if (!data) return <Loading />;

  async function saveTracks(tracks: Track[]) {
    setData({ ...data!, tracks });
    await api(`/playlists/${id}`, { method: 'PUT', body: { trackIds: tracks.map((x) => x.id) } });
  }

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= data!.tracks.length) return;
    const tracks = [...data!.tracks];
    [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
    void saveTracks(tracks);
  }

  async function rename(name: string) {
    await api(`/playlists/${id}`, { method: 'PUT', body: { name } });
    setRenaming(false);
    changed();
  }

  async function remove() {
    if (!window.confirm(t.deletePlaylistConfirm(data!.name))) return;
    await api(`/playlists/${id}`, { method: 'DELETE' });
    changed();
    navigate('playlists');
  }

  const first = data.tracks.find((track) => track.hasCover);
  const duration = data.tracks.reduce((sum, track) => sum + track.duration, 0);

  return (
    <div className="page">
      <header className="hero">
        <Cover albumId={first?.albumId ?? null} hasCover={Boolean(first)} />
        <div className="hero-text">
          <span className="eyebrow">{t.playlist}</span>
          <h1>{data.name}</h1>
          <p className="hero-meta">
            <span>{t.songs(data.tracks.length)}</span>
            {duration > 0 && <span>{formatLongDuration(duration, language)}</span>}
          </p>
        </div>
      </header>
      <PlayActions onPlay={() => player.playTracks(data.tracks)} onShuffle={() => player.playTracks(data.tracks, 0, { shuffle: true })}>
        <button type="button" className="icon-button icon-button-large" onClick={() => setRenaming(true)} aria-label={t.rename} title={t.rename}>
          <Icon name="edit" size={24} />
        </button>
        <button type="button" className="icon-button icon-button-large" onClick={remove} aria-label={t.delete} title={t.delete}>
          <Icon name="trash" size={24} />
        </button>
      </PlayActions>
      {data.tracks.length === 0 ? (
        <Empty icon="playlist" title={t.emptyPlaylist} />
      ) : (
        <TrackList
          tracks={data.tracks}
          extraActions={[
            { label: t.moveUp, onSelect: (i) => move(i, -1) },
            { label: t.moveDown, onSelect: (i) => move(i, 1) },
            { label: t.removeFromPlaylist, onSelect: (i) => void saveTracks(data.tracks.filter((_, x) => x !== i)) },
          ]}
        />
      )}
      {renaming && <NameDialog title={t.rename} initial={data.name} onSave={rename} onClose={() => setRenaming(false)} />}
    </div>
  );
}

export function Favorites() {
  const { t } = useI18n();
  const player = usePlayer();
  const { version } = useFavorites();
  const { data, error, reload } = useApi<Track[]>(`/favorites?v=${version}`);

  return (
    <div className="page">
      <header className="hero">
        <div className="cover cover-liked" aria-hidden="true">
          <Icon name="heart" size={56} />
        </div>
        <div className="hero-text">
          <span className="eyebrow">{t.playlist}</span>
          <h1>{t.favorites}</h1>
          {data && <p className="hero-meta"><span>{t.songs(data.length)}</span></p>}
        </div>
      </header>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty icon="heart" title={t.favorites}>
          <p>{t.emptyFavorites}</p>
        </Empty>
      ) : (
        <>
          <PlayActions onPlay={() => player.playTracks(data)} onShuffle={() => player.playTracks(data, 0, { shuffle: true })} />
          <TrackList tracks={data} />
        </>
      )}
    </div>
  );
}
