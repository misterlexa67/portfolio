/* Своя система иконок: тонкая линия 1.5, скруглённые концы, сетка 24. */

const PATHS: Record<string, string> = {
  arrow: 'M4 12h15M13 6l6 6-6 6',
  arrowDown: 'M12 4v15M6 13l6 6 6-6',
  check: 'M4.5 12.5l4.5 4.5L19.5 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  info: 'M12 11v6M12 7.5v.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5',
  download: 'M12 4v11M8 11l4 4 4-4M5 19h14',
  send: 'M20 4L3 11l6.5 2.5L12 20l8-16zM9.5 13.5L20 4',
  chat: 'M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 3.5V17h0A1.5 1.5 0 014 15.5z',
  phone: 'M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 006.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 01-1.6 1.5A16 16 0 013.5 5.6 1.5 1.5 0 015 4z',
  calendar: 'M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM4 10h16M8 3.5v4M16 3.5v4',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  ruler: 'M3.5 16.5L16.5 3.5l4 4-13 13zM7 13l2 2M10 10l2 2M13 7l2 2',
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 017 0v2.5',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  doc: 'M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M9 12h6M9 15.5h6',
  home: 'M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0',
  logout: 'M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 16l-4-4 4-4M6 12h10',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.5 6A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.6 3.4M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 004.2 4.2',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.6-5.7-3.8-8.8-1.3 2-2.2 2.9-3.4 3.3.3-2.5-.6-4.8-2.6-6.3.2 3.8-3.2 6.3-3.2 11.1 0 3.9 2.6 6.9 6.5 6.9z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  coins: 'M4 7c0-1.4 3.6-2.5 8-2.5s8 1.1 8 2.5-3.6 2.5-8 2.5S4 8.4 4 7zM4 7v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V7M4 12v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5',
  photo: 'M4 6h16v13H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  shield: 'M12 3.5l7.5 3v5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5v-5zM8.5 12l2.5 2.5 4.5-5',
  csv: 'M5 3.5h9l4 4V20.5H5zM8 12.5h2M8 16h2M12.5 12.5h3M12.5 16h3',
  bell: 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 004 0',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-.9-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.4-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
