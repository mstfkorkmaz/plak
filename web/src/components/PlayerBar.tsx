import { useEffect, useState, type CSSProperties } from 'react';
import { useFavorites } from '../favorites';
import { formatDuration, useI18n } from '../i18n';
import { usePlayer, useProgress } from '../player';
import { href } from '../router';
import { Icon } from './Icon';
import { Cover, IconButton } from './ui';

function readVolume(): number {
  try {
    const saved = Number(localStorage.getItem('plak:volume'));
    return Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : 0.8;
  } catch {
    return 0.8;
  }
}

function Slider({
  value,
  max,
  onChange,
  label,
  className = '',
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <input
      type="range"
      className={`slider ${className}`}
      min={0}
      max={max || 1}
      step="any"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
      style={{ '--fill': `${percent}%` } as CSSProperties}
    />
  );
}

export function PlayerBar({ queueOpen, onToggleQueue }: { queueOpen: boolean; onToggleQueue: () => void }) {
  const { t } = useI18n();
  const player = usePlayer();
  const favorites = useFavorites();
  const { time, duration } = useProgress(player.audio);
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    player.audio.volume = volume;
    player.audio.muted = muted;
    try {
      localStorage.setItem('plak:volume', String(volume));
    } catch {
      // Not persisted; harmless.
    }
  }, [player.audio, volume, muted]);

  // Space toggles playback unless the user is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code !== 'Space' || target.closest('input, textarea, button, [contenteditable]')) return;
      event.preventDefault();
      player.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const track = player.current;
  const total = duration || track?.duration || 0;
  const liked = track ? favorites.has(track.id) : false;

  return (
    <footer className={`player${track ? '' : ' is-idle'}`} aria-label={t.nowPlaying}>
      <div className="player-track">
        {track && (
          <>
            <a href={href('album', track.albumId)} className="player-cover">
              <Cover albumId={track.albumId} hasCover={track.hasCover} alt={track.album} />
            </a>
            <div className="player-text">
              <a className="player-title" href={href('album', track.albumId)}>
                {track.title}
              </a>
              <a className="player-artist" href={href('artist', track.artistId)}>
                {track.artist}
              </a>
            </div>
            <IconButton
              icon={liked ? 'heart' : 'heartOutline'}
              label={liked ? t.unlike : t.like}
              active={liked}
              onClick={() => favorites.toggle(track.id)}
              size={18}
              className="like hide-narrow"
            />
          </>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <IconButton icon="shuffle" label={t.shuffle} active={player.shuffle} onClick={player.toggleShuffle} size={18} className="hide-narrow" />
          <IconButton icon="previous" label={t.previous} onClick={player.previous} className="hide-narrow" />
          <button
            type="button"
            className="play-button"
            onClick={player.toggle}
            aria-label={player.playing ? t.pause : t.play}
            disabled={!track}
          >
            <Icon name={player.playing ? 'pause' : 'play'} size={20} />
          </button>
          <IconButton icon="next" label={t.next} onClick={player.next} />
          <span className="repeat-wrap hide-narrow">
            <IconButton icon="repeat" label={`${t.repeat}: ${player.repeat}`} active={player.repeat !== 'off'} onClick={player.cycleRepeat} size={18} />
            {player.repeat === 'one' && <span className="repeat-one">1</span>}
          </span>
        </div>
        <div className="player-progress">
          <span className="time">{formatDuration(time)}</span>
          <Slider
            value={time}
            max={total}
            label={t.duration}
            onChange={(value) => {
              player.audio.currentTime = value;
            }}
            className="seek"
          />
          <span className="time">{formatDuration(total)}</span>
        </div>
      </div>

      <div className="player-side">
        <IconButton icon="queue" label={t.queue} active={queueOpen} onClick={onToggleQueue} size={18} />
        <span className="volume hide-narrow">
          <IconButton icon={muted || volume === 0 ? 'mute' : 'volume'} label={t.mute} onClick={() => setMuted((m) => !m)} size={18} />
          <Slider
            value={muted ? 0 : volume}
            max={1}
            label={t.volume}
            onChange={(value) => {
              setMuted(false);
              setVolume(value);
            }}
          />
        </span>
      </div>
    </footer>
  );
}

