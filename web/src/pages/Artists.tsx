import { useApi, type Artist, type ArtistDetail } from '../api';
import { AlbumCard, ArtistCard, Grid } from '../components/Cards';
import { TrackList } from '../components/TrackList';
import { Cover, Empty, ErrorState, Loading, Section } from '../components/ui';
import { useI18n } from '../i18n';
import { usePlayer } from '../player';
import { PlayActions } from './Albums';

export function Artists() {
  const { t } = useI18n();
  const { data, error, reload } = useApi<Artist[]>('/artists');
  return (
    <div className="page">
      <h1 className="page-title">{t.artists}</h1>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty icon="artist" title={t.emptyLibrary} />
      ) : (
        <Grid>
          {data.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </Grid>
      )}
    </div>
  );
}

export function ArtistPage({ id }: { id: string }) {
  const { t } = useI18n();
  const player = usePlayer();
  const { data, error, reload } = useApi<ArtistDetail>(`/artists/${id}`);

  if (error) return <ErrorState onRetry={reload} notFound={error.status === 404 || error.status === 400} />;
  if (!data) return <Loading />;

  return (
    <div className="page">
      <header className="hero hero-artist">
        <Cover albumId={data.coverAlbumId} hasCover={Boolean(data.coverAlbumId)} alt={data.name} round />
        <div className="hero-text">
          <span className="eyebrow">{t.artist}</span>
          <h1>{data.name}</h1>
          <p className="hero-meta">
            <span>{t.albumCount(data.albumCount)}</span>
            <span>{t.songs(data.trackCount)}</span>
          </p>
        </div>
      </header>
      <PlayActions
        onPlay={() => player.playTracks(data.topTracks)}
        onShuffle={() => player.playTracks(data.topTracks, 0, { shuffle: true })}
      />
      {data.topTracks.length > 0 && (
        <Section title={t.popular}>
          <TrackList tracks={data.topTracks.slice(0, 5)} showAlbum={false} />
        </Section>
      )}
      {data.albums.length > 0 && (
        <Section title={t.discography}>
          <Grid>
            {data.albums.map((album) => (
              <AlbumCard key={album.id} album={album} subtitle={album.year ? String(album.year) : t.album} />
            ))}
          </Grid>
        </Section>
      )}
      {data.appearsOn.length > 0 && (
        <Section title={t.appearsOn}>
          <Grid>
            {data.appearsOn.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Grid>
        </Section>
      )}
    </div>
  );
}
