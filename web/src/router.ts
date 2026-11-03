import { useEffect, useState } from 'react';

// A tiny hash router: "#/album/3" -> ['album', '3']. Hash URLs need no server
// configuration and survive page reloads.
function current(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const update = () => {
      setRoute(current());
      document.querySelector('main')?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

export const href = (...parts: (string | number)[]) => `#/${parts.map((p) => encodeURIComponent(p)).join('/')}`;

export function navigate(...parts: (string | number)[]) {
  window.location.hash = href(...parts);
}
