import { useState } from 'react';
import { useApi, type Album, type AlbumDetail } from '../api';
import { AlbumCard, Grid } from '../components/Cards';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { Cover, Empty, ErrorState, Loading } from '../components/ui';
import { formatLongDuration, useI18n } from '../i18n';
import { usePlayer } from '../player';
import { href } from '../router';
import { usePlaylistPicker } from '../components/PlaylistPicker';

type Sort = 'name' | 'recent' | 'year' | 'random';

export function Albums() {
  const { t } = useI18n();
  const [sort, setSort] = useState<Sort>('name');
  const { data, error, reload } = useApi<Album[]>(`/albums?sort=${sort}&limit=500`);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t.albums}</h1>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="name">{t.sortName}</option>
          <option value="recent">{t.sortRecent}</option>
          <option value="year">{t.sortYear}</option>
          <option value="random">{t.sortRandom}</option>
        </select>
      </div>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty icon="album" title={t.emptyLibrary}>
          <p>{t.emptyLibraryHint}</p>
        </Empty>
      ) : (
        <Grid>
          {data.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </Grid>
      )}
    </div>
  );
}

export function AlbumPage({ id }: { id: string }) {
  const { t, language } = useI18n();
  const player = usePlayer();
  const pickPlaylist = usePlaylistPicker();
  const { data, error, reload } = useApi<AlbumDetail>(`/albums/${id}`);

  if (error) return <ErrorState onRetry={reload} notFound={error.status === 404 || error.status === 400} />;
  if (!data) return <Loading />;

  return (
    <div className="page">
      <header className="hero">
        <Cover albumId={data.id} hasCover={data.hasCover} alt={data.title} />
        <div className="hero-text">
          <span className="eyebrow">{t.album}</span>
          <h1>{data.title}</h1>
          <p className="hero-meta">
            <a href={href('artist', data.artistId)}>{data.artist}</a>
            {data.year && <span>{data.year}</span>}
            <span>{t.songs(data.trackCount)}</span>
            <span>{formatLongDuration(data.duration, language)}</span>
          </p>
        </div>
      </header>
      <PlayActions
        onPlay={() => player.playTracks(data.tracks)}
        onShuffle={() => player.playTracks(data.tracks, 0, { shuffle: true })}
        onAdd={() => pickPlaylist(data.tracks)}
      />
      <TrackList tracks={data.tracks} showCover={false} showAlbum={false} numbered />
    </div>
  );
}

export function PlayActions({ onPlay, onShuffle, onAdd, children }: { onPlay: () => void; onShuffle: () => void; onAdd?: () => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="actions">
      <button type="button" className="play-button play-button-large" onClick={onPlay} aria-label={t.play}>
        <Icon name="play" size={26} />
      </button>
      <button type="button" className="icon-button icon-button-large" onClick={onShuffle} aria-label={t.shuffle} title={t.shuffle}>
        <Icon name="shuffle" size={26} />
      </button>
      {onAdd && (
        <button type="button" className="icon-button icon-button-large" onClick={onAdd} aria-label={t.addToPlaylist} title={t.addToPlaylist}>
          <Icon name="plus" size={26} />
        </button>
      )}
      {children}
    </div>
  );
}
