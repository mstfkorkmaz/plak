import { useApi, type Album, type Track } from '../api';
import { AlbumCard, Grid } from '../components/Cards';
import { TrackList } from '../components/TrackList';
import { Empty, ErrorState, Loading, Section } from '../components/ui';
import { useI18n } from '../i18n';
import { usePlayer } from '../player';
import { href } from '../router';
import { Cover } from '../components/ui';

type HomeData = { recentlyAdded: Album[]; recentlyPlayed: Track[]; mostPlayed: Track[]; discover: Album[] };

function greeting(t: ReturnType<typeof useI18n>['t']) {
  const hour = new Date().getHours();
  return hour < 12 ? t.goodMorning : hour < 18 ? t.goodAfternoon : t.goodEvening;
}

export function Home() {
  const { t } = useI18n();
  const player = usePlayer();
  const { data, error, reload } = useApi<HomeData>('/home');

  if (error) return <ErrorState onRetry={reload} />;
  if (!data) return <Loading />;

  if (data.recentlyAdded.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">{greeting(t)}</h1>
        <Empty icon="music" title={t.emptyLibrary}>
          <p>{t.emptyLibraryHint}</p>
          <a className="button" href={href('settings')}>
            {t.openSettings}
          </a>
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">{greeting(t)}</h1>

      {data.recentlyPlayed.length > 0 && (
        <div className="quick-grid">
          {data.recentlyPlayed.slice(0, 6).map((track, index) => (
            <button key={track.id} type="button" className="quick" onClick={() => player.playTracks(data.recentlyPlayed, index)}>
              <Cover albumId={track.albumId} hasCover={track.hasCover} />
              <span>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <Section title={t.recentlyAdded} action={<a className="link-button" href={href('albums')}>{t.albums}</a>}>
        <Grid>
          {data.recentlyAdded.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </Grid>
      </Section>

      {data.mostPlayed.length > 0 && (
        <Section title={t.mostPlayed}>
          <TrackList tracks={data.mostPlayed} />
        </Section>
      )}

      <Section title={t.discover}>
        <Grid>
          {data.discover.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </Grid>
      </Section>
    </div>
  );
}
