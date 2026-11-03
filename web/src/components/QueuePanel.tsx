import { useI18n } from '../i18n';
import { usePlayer } from '../player';
import { Icon } from './Icon';
import { Cover, IconButton } from './ui';

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const player = usePlayer();
  const upcoming = player.queue.map((track, index) => ({ track, index })).slice(player.index + 1);

  return (
    <aside className="queue" aria-label={t.queue}>
      <div className="queue-head">
        <h2>{t.queue}</h2>
        <IconButton icon="close" label={t.cancel} onClick={onClose} />
      </div>
      {player.current && (
        <>
          <h3>{t.nowPlaying}</h3>
          <div className="queue-item is-current">
            <Cover albumId={player.current.albumId} hasCover={player.current.hasCover} />
            <span>
              <strong>{player.current.title}</strong>
              <small>{player.current.artist}</small>
            </span>
          </div>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="queue-subhead">
            <h3>{t.upNext}</h3>
            <button type="button" className="link-button" onClick={player.clearUpcoming}>
              {t.clearQueue}
            </button>
          </div>
          <ol className="queue-list">
            {upcoming.map(({ track, index }) => (
              <li key={`${track.id}-${index}`} className="queue-item">
                <button type="button" className="queue-jump" onClick={() => player.jumpTo(index)} aria-label={`${t.play}: ${track.title}`}>
                  <Cover albumId={track.albumId} hasCover={track.hasCover} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => player.removeFromQueue(index)}
                  aria-label={`${t.delete}: ${track.title}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
