import { useEffect, useState } from 'react';
import { api, type PlaylistSummary } from '../api';
import { useI18n } from '../i18n';
import { href } from '../router';
import { Icon, type IconName } from './Icon';

const LINKS: { route: string; icon: IconName; key: 'home' | 'search' | 'albums' | 'artists' | 'playlists' | 'favorites' | 'settings' }[] = [
  { route: '', icon: 'home', key: 'home' },
  { route: 'search', icon: 'search', key: 'search' },
  { route: 'albums', icon: 'album', key: 'albums' },
  { route: 'artists', icon: 'artist', key: 'artists' },
  { route: 'playlists', icon: 'playlist', key: 'playlists' },
  { route: 'favorites', icon: 'heart', key: 'favorites' },
  { route: 'settings', icon: 'settings', key: 'settings' },
];

// Mobile bottom bar shows only the most used destinations.
const MOBILE = new Set(['', 'search', 'albums', 'playlists', 'settings']);

export function Sidebar({ active }: { active: string }) {
  const { t } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);

  useEffect(() => {
    const load = () => api<PlaylistSummary[]>('/playlists').then(setPlaylists).catch(() => {});
    load();
    window.addEventListener('plak:playlists-changed', load);
    return () => window.removeEventListener('plak:playlists-changed', load);
  }, []);

  return (
    <nav className="sidebar" aria-label="Plak">
      <a className="brand" href="#/">
        <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.12" />
          <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
          <circle cx="32" cy="32" r="10" fill="var(--accent)" />
          <circle cx="32" cy="32" r="2.5" fill="var(--bg)" />
        </svg>
        <span>Plak</span>
      </a>
      <ul className="nav">
        {LINKS.map((link) => (
          <li key={link.key} className={MOBILE.has(link.route) ? '' : 'desktop-only'}>
            <a href={href(link.route)} className={active === link.route ? 'is-active' : ''} aria-current={active === link.route ? 'page' : undefined}>
              <Icon name={link.icon} size={22} />
              <span>{t[link.key]}</span>
            </a>
          </li>
        ))}
      </ul>
      {playlists.length > 0 && (
        <div className="sidebar-playlists desktop-only">
          <h2>{t.playlists}</h2>
          <ul>
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <a href={href('playlist', playlist.id)}>{playlist.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
