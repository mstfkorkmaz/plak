import { useEffect, useState } from 'react';
import { useApi, type Album, type Artist, type Track } from '../api';
import { AlbumCard, ArtistCard, Grid } from '../components/Cards';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { Empty, ErrorState, Loading, Section } from '../components/ui';
import { useI18n } from '../i18n';

type Results = { artists: Artist[]; albums: Album[]; tracks: Track[] };

function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function Search() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const { data, error, reload } = useApi<Results>(term ? `/search?q=${encodeURIComponent(term)}` : null);

  const empty = data && !data.artists.length && !data.albums.length && !data.tracks.length;

  return (
    <div className="page">
      <label className="search-box">
        <Icon name="search" size={22} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          autoFocus
          maxLength={100}
        />
      </label>

      {!term ? (
        <Empty icon="search" title={t.search}>
          <p>{t.searchHint}</p>
        </Empty>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : empty ? (
        <Empty icon="search" title={t.noResults(term)} />
      ) : (
        <>
          {data.tracks.length > 0 && (
            <Section title={t.songsHeading}>
              <TrackList tracks={data.tracks.slice(0, 10)} />
            </Section>
          )}
          {data.artists.length > 0 && (
            <Section title={t.artists}>
              <Grid>
                {data.artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </Grid>
            </Section>
          )}
          {data.albums.length > 0 && (
            <Section title={t.albums}>
              <Grid>
                {data.albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </Grid>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
