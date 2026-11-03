import { useEffect, useRef, useState } from 'react';
import type { Track } from '../api';
import { useFavorites } from '../favorites';
import { formatDuration, useI18n } from '../i18n';
import { usePlayer } from '../player';
import { href, navigate } from '../router';
import { useToast } from '../toast';
import { Icon } from './Icon';
import { usePlaylistPicker } from './PlaylistPicker';
import { Cover } from './ui';

export type ExtraAction = { label: string; onSelect: (index: number) => void };

type Props = {
  tracks: Track[];
  showCover?: boolean;
  showAlbum?: boolean;
  numbered?: boolean;
  extraActions?: ExtraAction[];
};

export function TrackList({ tracks, showCover = true, showAlbum = true, numbered = false, extraActions = [] }: Props) {
  const { t } = useI18n();
  const player = usePlayer();
  const favorites = useFavorites();

  return (
    <div className={`tracks${showAlbum ? '' : ' tracks-no-album'}`} role="table">
      <div className="track track-head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">{t.title}</span>
        {showAlbum && <span role="columnheader" className="hide-narrow">{t.album}</span>}
        <span role="columnheader" aria-label={t.duration} className="track-duration">
          <Icon name="clock" size={16} />
        </span>
      </div>
      {tracks.map((track, index) => {
        const isCurrent = player.current?.id === track.id;
        const liked = favorites.has(track.id);
        return (
          <div
            key={`${track.id}-${index}`}
            className={`track${isCurrent ? ' is-current' : ''}`}
            role="row"
            onDoubleClick={() => player.playTracks(tracks, index)}
          >
            <span className="track-index" role="cell">
              <span className="track-number">
                {isCurrent && player.playing ? (
                  <span className="equalizer" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : numbered ? (
                  (track.trackNo ?? index + 1)
                ) : (
                  index + 1
                )}
              </span>
              <button
                type="button"
                className="track-play"
                aria-label={`${t.play}: ${track.title}`}
                onClick={() => (isCurrent ? player.toggle() : player.playTracks(tracks, index))}
              >
                <Icon name={isCurrent && player.playing ? 'pause' : 'play'} size={16} />
              </button>
            </span>
            <span className="track-main" role="cell">
              {showCover && <Cover albumId={track.albumId} hasCover={track.hasCover} />}
              <span className="track-text">
                <span className="track-title">{track.title}</span>
                <a className="track-artist" href={href('artist', track.artistId)}>
                  {track.artist}
                </a>
              </span>
            </span>
            {showAlbum && (
              <a className="track-album hide-narrow" role="cell" href={href('album', track.albumId)}>
                {track.album}
              </a>
            )}
            <span className="track-end" role="cell">
              <button
                type="button"
                className={`icon-button like${liked ? ' is-active' : ''}`}
                aria-label={liked ? t.unlike : t.like}
                aria-pressed={liked}
                onClick={() => favorites.toggle(track.id)}
              >
                <Icon name={liked ? 'heart' : 'heartOutline'} size={18} />
              </button>
              <span className="track-duration">{formatDuration(track.duration)}</span>
              <TrackMenu track={track} index={index} extraActions={extraActions} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrackMenu({ track, index, extraActions }: { track: Track; index: number; extraActions: ExtraAction[] }) {
  const { t } = useI18n();
  const player = usePlayer();
  const pickPlaylist = usePlaylistPicker();
  const toast = useToast();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && menu.current?.contains(event.target as Node)) return;
      setPosition(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menu.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [position]);

  function open() {
    if (position) return setPosition(null);
    const rect = button.current!.getBoundingClientRect();
    const width = 220;
    const height = 44 * (5 + extraActions.length);
    setPosition({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: rect.bottom + height > window.innerHeight - 8 ? Math.max(8, rect.top - height) : rect.bottom + 4,
    });
  }

  const items: { label: string; run: () => void }[] = [
    { label: t.playNext, run: () => (player.playNext([track]), toast(t.playNext)) },
    { label: t.addToQueue, run: () => (player.addToQueue([track]), toast(t.addToQueue)) },
    { label: t.addToPlaylist, run: () => pickPlaylist([track]) },
    { label: t.goToAlbum, run: () => navigate('album', track.albumId) },
    { label: t.goToArtist, run: () => navigate('artist', track.artistId) },
    ...extraActions.map((action) => ({ label: action.label, run: () => action.onSelect(index) })),
  ];

  return (
    <>
      <button
        ref={button}
        type="button"
        className="icon-button track-more"
        aria-label={`${t.more}: ${track.title}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        onClick={open}
      >
        <Icon name="more" size={18} />
      </button>
      {position && (
        <div ref={menu} className="menu" role="menu" style={position}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setPosition(null);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
