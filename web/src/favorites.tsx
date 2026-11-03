import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

type Favorites = { has: (id: number) => boolean; toggle: (id: number) => void; version: number };

const FavoritesContext = createContext<Favorites | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<number[]>('/favorites/ids')
      .then((list) => setIds(new Set(list)))
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: number) => {
    setIds((current) => {
      const next = new Set(current);
      const liked = next.has(id);
      if (liked) next.delete(id);
      else next.add(id);
      // Optimistic update: show the change at once, roll back if the server refuses.
      api(`/favorites/${id}`, { method: liked ? 'DELETE' : 'PUT' })
        .then(() => setVersion((v) => v + 1))
        .catch(() => setIds(current));
      return next;
    });
  }, []);

  const has = useCallback((id: number) => ids.has(id), [ids]);

  return <FavoritesContext.Provider value={{ has, toggle, version }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): Favorites {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider');
  return value;
}
