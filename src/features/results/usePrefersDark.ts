import { useEffect, useState } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

/** Follows the OS colour scheme, as the page's Tailwind dark: variants do. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => {
      setDark(media.matches);
    };
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
    };
  }, []);
  return dark;
}
