import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, useApi, type User } from '../api';
import { Icon } from '../components/Icon';
import { useI18n, type Language } from '../i18n';

type Stats = { tracks: number; albums: number; artists: number; duration: number; size: number };
type ScanStatus = {
  running: boolean;
  finishedAt: number | null;
  seen: number;
  added: number;
  updated: number;
  removed: number;
  errors: number;
  lastError: string | null;
  musicDir: string;
};
type UserRow = { id: number; username: string; isAdmin: number; createdAt: number };

function formatSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function errorText(t: ReturnType<typeof useI18n>['t'], error: unknown) {
  const code = error instanceof ApiError ? error.message : '';
  if (code in t && typeof t[code as keyof typeof t] === 'string') return t[code as keyof typeof t] as string;
  return code === 'FST_ERR_VALIDATION' || (error instanceof ApiError && error.status === 400) ? t.validation : t.error;
}

function Library({ isAdmin }: { isAdmin: boolean }) {
  const { t, language } = useI18n();
  const stats = useApi<Stats>('/stats');
  const [scan, setScan] = useState<ScanStatus | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    api<ScanStatus>('/admin/scan').then(setScan).catch(() => {});
  }, [isAdmin]);

  // Poll while a scan is running, then refresh the numbers.
  useEffect(() => {
    if (!scan?.running) return;
    const id = window.setInterval(async () => {
      const next = await api<ScanStatus>('/admin/scan');
      setScan(next);
      if (!next.running) stats.reload();
    }, 1000);
    return () => window.clearInterval(id);
  }, [scan?.running, stats]);

  const s = stats.data;
  return (
    <section className="panel">
      <h2>{t.libraryStats}</h2>
      {s && (
        <dl className="stats">
          <div><dt>{t.tracksStat}</dt><dd>{s.tracks.toLocaleString(language)}</dd></div>
          <div><dt>{t.albumsStat}</dt><dd>{s.albums.toLocaleString(language)}</dd></div>
          <div><dt>{t.artistsStat}</dt><dd>{s.artists.toLocaleString(language)}</dd></div>
          <div><dt>{t.hoursStat}</dt><dd>{Math.round(s.duration / 3600).toLocaleString(language)}</dd></div>
          <div><dt>{t.sizeStat}</dt><dd>{formatSize(s.size)}</dd></div>
        </dl>
      )}
      {isAdmin && scan && (
        <div className="scan">
          <p className="muted">
            {t.musicFolder}: <code>{scan.musicDir}</code>
          </p>
          <button type="button" className="button" disabled={scan.running} onClick={async () => setScan(await api<ScanStatus>('/admin/scan', { method: 'POST' }))}>
            {scan.running ? t.scanning : t.scanNow}
          </button>
          {(scan.running || scan.finishedAt) && (
            <p className="muted">
              {scan.finishedAt && !scan.running && `${t.lastScan}: ${new Date(scan.finishedAt).toLocaleString(language)} · `}
              {t.scanResult(scan.seen, scan.added, scan.updated, scan.removed)}
            </p>
          )}
          {scan.lastError && <p className="warning">{scan.lastError}</p>}
        </div>
      )}
    </section>
  );
}

function Password() {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/auth/password', { method: 'POST', body: { current, next } });
      setCurrent('');
      setNext('');
      setMessage(t.passwordChanged);
    } catch (error) {
      setMessage(errorText(t, error));
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h3>{t.changePassword}</h3>
      <input className="input" type="password" autoComplete="current-password" placeholder={t.currentPassword} value={current} onChange={(e) => setCurrent(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" placeholder={t.newPassword} minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      <div className="row-end">
        <button className="button" disabled={!current || next.length < 8}>{t.save}</button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
    </form>
  );
}

function Users({ me }: { me: User }) {
  const { t, language } = useI18n();
  const { data, reload } = useApi<UserRow[]>('/admin/users');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/admin/users', { method: 'POST', body: { username, password, isAdmin } });
      setUsername('');
      setPassword('');
      setIsAdmin(false);
      setMessage(null);
      reload();
    } catch (error) {
      setMessage(errorText(t, error));
    }
  }

  return (
    <section className="panel">
      <h2>{t.users}</h2>
      <p className="muted">{t.usersHint}</p>
      <ul className="user-list">
        {data?.map((user) => (
          <li key={user.id}>
            <span className="avatar" aria-hidden="true">{user.username.slice(0, 1).toLocaleUpperCase(language)}</span>
            <span>
              <strong>{user.username}</strong>
              {user.id === me.id && <small> ({t.you})</small>}
              {user.isAdmin ? <span className="badge">{t.admin}</span> : null}
            </span>
            {user.id !== me.id && (
              <button
                type="button"
                className="icon-button"
                aria-label={`${t.delete}: ${user.username}`}
                onClick={async () => {
                  await api(`/admin/users/${user.id}`, { method: 'DELETE' });
                  reload();
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="stack" onSubmit={add}>
        <h3>{t.addUser}</h3>
        <input className="input" placeholder={t.username} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" type="password" placeholder={t.password} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> {t.admin}
        </label>
        <div className="row-end">
          <button className="button" disabled={username.length < 2 || password.length < 8}>{t.addUser}</button>
        </div>
        {message && <p className="warning" role="alert">{message}</p>}
      </form>
    </section>
  );
}

export function Settings({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { t, language, setLanguage } = useI18n();
  return (
    <div className="page settings">
      <h1 className="page-title">{t.settings}</h1>
      <Library isAdmin={user.isAdmin} />
      <section className="panel">
        <h2>{t.account}</h2>
        <p className="muted">{t.signedInAs(user.username)}</p>
        <label className="field">
          <span>{t.language}</span>
          <select className="select" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>
        <Password />
        <button type="button" className="button button-secondary" onClick={onLogout}>
          <Icon name="logout" size={18} /> {t.logout}
        </button>
      </section>
      {user.isAdmin && <Users me={user} />}
      <p className="muted about">
        {t.about} <a href="https://github.com/solidcode-tr/plak" target="_blank" rel="noreferrer">GitHub</a>
      </p>
    </div>
  );
}

export function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: (user: User) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>(needsSetup ? '/auth/setup' : '/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      onDone(user);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" className="login-logo">
          <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.1" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
          <circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="32" cy="32" r="10" fill="var(--accent)" />
          <circle cx="32" cy="32" r="2.5" fill="var(--bg)" />
        </svg>
        <h1>{needsSetup ? t.welcome : t.signIn}</h1>
        <p className="muted">{needsSetup ? t.setupIntro : t.signInIntro}</p>
        <label className="field">
          <span>{t.username}</span>
          <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>{t.password}</span>
          <input
            className="input"
            type="password"
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={needsSetup ? 8 : undefined}
            required
          />
          {needsSetup && <small className="muted">{t.passwordHint}</small>}
        </label>
        {error && <p className="warning" role="alert">{error}</p>}
        <button className="button button-block" disabled={busy}>
          {needsSetup ? t.createAccount : t.signIn}
        </button>
      </form>
    </main>
  );
}
