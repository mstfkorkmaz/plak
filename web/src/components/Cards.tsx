import { api, type Album, type AlbumDetail, type Artist, type PlaylistSummary } from '../api';
import { useI18n } from '../i18n';
import { usePlayer } from '../player';
import { href } from '../router';
import { Icon } from './Icon';
import { Cover } from './ui';

function PlayOverlay({ label, onPlay }: { label: string; onPlay: () => void }) {
  return (
    <button
      type="button"
      className="card-play"
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        onPlay();
      }}
    >
      <Icon name="play" size={22} />
    </button>
  );
}

export function AlbumCard({ album, subtitle }: { album: Album; subtitle?: string }) {
  const { t } = useI18n();
  const player = usePlayer();
  const play = async () => {
    const detail = await api<AlbumDetail>(`/albums/${album.id}`);
    player.playTracks(detail.tracks);
  };
  return (
    <a className="card" href={href('album', album.id)}>
      <div className="card-art">
        <Cover albumId={album.id} hasCover={album.hasCover} />
        <PlayOverlay label={`${t.play}: ${album.title}`} onPlay={play} />
      </div>
      <strong className="card-title">{album.title}</strong>
      <span className="card-subtitle">{subtitle ?? [album.year, album.artist].filter(Boolean).join(' · ')}</span>
    </a>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const { t } = useI18n();
  return (
    <a className="card card-artist" href={href('artist', artist.id)}>
      <div className="card-art">
        <Cover albumId={artist.coverAlbumId} hasCover={Boolean(artist.coverAlbumId)} round />
      </div>
      <strong className="card-title">{artist.name}</strong>
      <span className="card-subtitle">{t.albumCount(artist.albumCount)}</span>
    </a>
  );
}

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const { t } = useI18n();
  return (
    <a className="card" href={href('playlist', playlist.id)}>
      <div className="card-art">
        <Cover albumId={playlist.coverAlbumId} hasCover={Boolean(playlist.coverAlbumId)} />
      </div>
      <strong className="card-title">{playlist.name}</strong>
      <span className="card-subtitle">{t.songs(playlist.trackCount)}</span>
    </a>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid">{children}</div>;
}
