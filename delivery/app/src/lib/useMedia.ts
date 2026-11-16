import { useEffect, useState } from 'react';

export function useMedia(query: string): boolean {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const useDesktop = () => useMedia('(min-width: 1024px)');

export const newKey = (): string => `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
