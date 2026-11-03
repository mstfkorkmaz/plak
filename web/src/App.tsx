import { useCallback, useEffect, useState } from 'react';
import { api, type User } from './api';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistPickerProvider } from './components/PlaylistPicker';
import { QueuePanel } from './components/QueuePanel';
import { Sidebar } from './components/Sidebar';
import { Loading } from './components/ui';
import { FavoritesProvider } from './favorites';
import { AlbumPage, Albums } from './pages/Albums';
import { ArtistPage, Artists } from './pages/Artists';
import { Home } from './pages/Home';
import { Favorites, PlaylistPage, Playlists } from './pages/Playlists';
import { Search } from './pages/Search';
import { Login, Settings } from './pages/Settings';
import { PlayerProvider, usePlayer } from './player';
import { useRoute } from './router';
import { ToastProvider } from './toast';

type AuthState = { needsSetup: boolean; user: User | null };

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  const refresh = useCallback(() => {
    api<AuthState>('/auth/state')
      .then(setAuth)
      .catch(() => setAuth({ needsSetup: false, user: null }));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('plak:unauthorized', refresh);
    return () => window.removeEventListener('plak:unauthorized', refresh);
  }, [refresh]);

  if (!auth) return <Loading />;
  if (!auth.user) {
    return <Login needsSetup={auth.needsSetup} onDone={(user) => setAuth({ needsSetup: false, user })} />;
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.hash = '';
    window.location.reload();
  };

  // Keyed by user so switching accounts resets the queue and favorites.
  return (
    <ToastProvider key={auth.user.id}>
      <FavoritesProvider>
        <PlayerProvider>
          <PlaylistPickerProvider>
            <Shell user={auth.user} onLogout={logout} />
          </PlaylistPickerProvider>
        </PlayerProvider>
      </FavoritesProvider>
    </ToastProvider>
  );
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [section = '', id = ''] = useRoute();
  const [queueOpen, setQueueOpen] = useState(false);
  const { current } = usePlayer();

  let page;
  switch (section) {
    case 'search':
      page = <Search />;
      break;
    case 'albums':
      page = <Albums />;
      break;
    case 'album':
      page = <AlbumPage key={id} id={id} />;
      break;
    case 'artists':
      page = <Artists />;
      break;
    case 'artist':
      page = <ArtistPage key={id} id={id} />;
      break;
    case 'playlists':
      page = <Playlists />;
      break;
    case 'playlist':
      page = <PlaylistPage key={id} id={id} />;
      break;
    case 'favorites':
      page = <Favorites />;
      break;
    case 'settings':
      page = <Settings user={user} onLogout={onLogout} />;
      break;
    default:
      page = <Home />;
  }

  const active = section === 'album' ? 'albums' : section === 'artist' ? 'artists' : section === 'playlist' ? 'playlists' : section;

  return (
    <div className={`shell${queueOpen ? ' with-queue' : ''}${current ? ' has-track' : ''}`}>
      <Sidebar active={active} />
      <main className="content">{page}</main>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      <PlayerBar queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((open) => !open)} />
    </div>
  );
}
