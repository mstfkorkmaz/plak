import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, coverUrl, streamUrl, type Track } from './api';

type Repeat = 'off' | 'all' | 'one';

type PlayerState = {
  queue: Track[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: Repeat;
  // Bumped on every explicit "play this", so replaying the same song restarts it.
  nonce: number;
};

type PlayerApi = PlayerState & {
  audio: HTMLAudioElement;
  current: Track | null;
  playTracks: (tracks: Track[], startIndex?: number, options?: { shuffle?: boolean }) => void;
  playNext: (tracks: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  jumpTo: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearUpcoming: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A play counts once the listener has heard 30 seconds or half the song.
const PLAY_THRESHOLD_SECONDS = 30;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useMemo(() => new Audio(), []);
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: -1,
    playing: false,
    shuffle: false,
    repeat: 'off',
    nonce: 0,
  });
  // Order before shuffling, so turning shuffle off restores it.
  const original = useRef<Track[]>([]);
  const reported = useRef<number | null>(null);
  const lastNonce = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const current = state.queue[state.index] ?? null;

  // Load a new source only when the current track actually changes.
  useEffect(() => {
    if (!current) {
      audio.removeAttribute('src');
      audio.load();
      return;
    }
    const src = streamUrl(current.id);
    if (!audio.src.endsWith(src)) {
      audio.src = src;
      reported.current = null;
    } else if (lastNonce.current !== state.nonce) {
      audio.currentTime = 0;
    }
    lastNonce.current = state.nonce;
    if (stateRef.current.playing) audio.play().catch(() => setState((s) => ({ ...s, playing: false })));
  }, [audio, current, state.nonce]);

  const advance = useCallback(
    (direction: 1 | -1, fromEnded = false) => {
      setState((s) => {
        if (s.queue.length === 0) return s;
        if (fromEnded && s.repeat === 'one') return { ...s, playing: true, nonce: s.nonce + 1 };
        let index = s.index + direction;
        if (index >= s.queue.length) {
          if (s.repeat === 'off') return { ...s, playing: false };
          index = 0;
        }
        if (index < 0) index = 0;
        return { ...s, index, playing: true, nonce: s.nonce + 1 };
      });
    },
    [],
  );

  useEffect(() => {
    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onEnded = () => advance(1, true);
    const onTime = () => {
      const track = stateRef.current.queue[stateRef.current.index];
      if (!track || reported.current === track.id) return;
      const threshold = Math.min(PLAY_THRESHOLD_SECONDS, (audio.duration || track.duration) / 2);
      if (audio.currentTime >= threshold) {
        reported.current = track.id;
        api(`/plays/${track.id}`, { method: 'POST' }).catch(() => {});
      }
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTime);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTime);
    };
  }, [audio, advance]);

  const toggle = useCallback(() => {
    if (!stateRef.current.queue.length) return;
    if (audio.paused) {
      setState((s) => ({ ...s, playing: true }));
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [audio]);

  const previous = useCallback(() => {
    // Like most players: restart the song unless we are at its very beginning.
    if (audio.currentTime > 3) audio.currentTime = 0;
    else advance(-1);
  }, [audio, advance]);

  const next = useCallback(() => advance(1), [advance]);

  // Lock screen, headphones and media keys.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = current
      ? new MediaMetadata({
          title: current.title,
          artist: current.artist,
          album: current.album,
          artwork: current.hasCover ? [{ src: coverUrl(current.albumId), sizes: '512x512' }] : [],
        })
      : null;
    session.setActionHandler('play', toggle);
    session.setActionHandler('pause', toggle);
    session.setActionHandler('nexttrack', next);
    session.setActionHandler('previoustrack', previous);
    session.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) audio.currentTime = details.seekTime;
    });
  }, [audio, current, toggle, next, previous]);

  useEffect(() => {
    document.title = current ? `${current.title} · ${current.artist}` : 'Plak';
  }, [current]);

  const value: PlayerApi = {
    ...state,
    audio,
    current,
    toggle,
    next,
    previous,
    playTracks(tracks, startIndex = 0, options = {}) {
      if (!tracks.length) return;
      original.current = tracks;
      const shuffle = options.shuffle ?? state.shuffle;
      if (shuffle) {
        const first = options.shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[startIndex];
        const rest = shuffled(tracks.filter((t) => t !== first));
        setState((s) => ({ ...s, queue: [first, ...rest], index: 0, playing: true, shuffle, nonce: s.nonce + 1 }));
      } else {
        setState((s) => ({ ...s, queue: tracks, index: startIndex, playing: true, nonce: s.nonce + 1 }));
      }
    },
    playNext(tracks) {
      setState((s) => {
        const queue = [...s.queue];
        queue.splice(s.index + 1, 0, ...tracks);
        return s.index < 0 ? { ...s, queue, index: 0, playing: true } : { ...s, queue };
      });
    },
    addToQueue(tracks) {
      setState((s) => (s.index < 0 ? { ...s, queue: tracks, index: 0, playing: true } : { ...s, queue: [...s.queue, ...tracks] }));
    },
    jumpTo(index) {
      setState((s) => ({ ...s, index, playing: true, nonce: s.nonce + 1 }));
    },
    removeFromQueue(index) {
      setState((s) => {
        if (index === s.index) return s;
        const queue = s.queue.filter((_, i) => i !== index);
        return { ...s, queue, index: index < s.index ? s.index - 1 : s.index };
      });
    },
    clearUpcoming() {
      setState((s) => ({ ...s, queue: s.queue.slice(0, s.index + 1) }));
    },
    toggleShuffle() {
      setState((s) => {
        const track = s.queue[s.index];
        if (!track) return { ...s, shuffle: !s.shuffle };
        if (!s.shuffle) {
          original.current = s.queue;
          const rest = shuffled(s.queue.filter((_, i) => i !== s.index));
          return { ...s, shuffle: true, queue: [track, ...rest], index: 0 };
        }
        const queue = original.current.length ? original.current : s.queue;
        return { ...s, shuffle: false, queue, index: Math.max(0, queue.indexOf(track)) };
      });
    },
    cycleRepeat() {
      setState((s) => ({ ...s, repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }));
    },
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider');
  return value;
}

// Progress changes several times a second; keep it out of the shared context so
// only the components that show it re-render.
export function useProgress(audio: HTMLAudioElement) {
  const [progress, setProgress] = useState({ time: audio.currentTime, duration: audio.duration || 0 });
  useEffect(() => {
    const update = () => setProgress({ time: audio.currentTime, duration: audio.duration || 0 });
    const events = ['timeupdate', 'durationchange', 'seeked', 'emptied'];
    events.forEach((e) => audio.addEventListener(e, update));
    return () => events.forEach((e) => audio.removeEventListener(e, update));
  }, [audio]);
  return progress;
}
