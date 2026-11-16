// Собственный набор иконок: 24×24, штрих 1.75, скруглённые концы.
import type { SVGProps } from 'react';

const P: Record<string, JSX.Element> = {
  home: <><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bag: <><path d="M5.5 8h13l-1 11.2a1 1 0 0 1-1 .8h-9a1 1 0 0 1-1-.8z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></>,
  user: <><circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20c.9-3.6 3.8-5.5 7.25-5.5s6.35 1.9 7.25 5.5" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  star: <><path d="m12 4 2.35 4.95 5.4.7-3.95 3.75 1 5.35L12 16.1l-4.8 2.65 1-5.35L4.25 9.65l5.4-.7z" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  chevronDown: <><path d="m6.5 9.5 5.5 5.5 5.5-5.5" /></>,
  chevronRight: <><path d="m9.5 6 6 6-6 6" /></>,
  back: <><path d="M14.5 5.5 8 12l6.5 6.5" /></>,
  plus: <><path d="M12 5.5v13M5.5 12h13" /></>,
  minus: <><path d="M5.5 12h13" /></>,
  close: <><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></>,
  heart: <><path d="M12 19.5s-7.5-4.4-7.5-10A4.25 4.25 0 0 1 12 6.8a4.25 4.25 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10z" /></>,
  filter: <><path d="M4.5 7h9M17.5 7h2M4.5 17h2M10.5 17h9" /><circle cx="15.5" cy="7" r="2" /><circle cx="8.5" cy="17" r="2" /></>,
  wallet: <><rect x="3.75" y="6" width="16.5" height="13" rx="2.5" /><path d="M16 12.5h4.25M6.5 6l8.5-2.25a1.5 1.5 0 0 1 1.85 1.1L17 6" /></>,
  check: <><path d="m5.5 12.5 4 4 9-9" /></>,
  info: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l.8 11.2a1 1 0 0 0 1 .8h6.4a1 1 0 0 0 1-.8L17 7" /></>,
  edit: <><path d="m14.5 6 3.5 3.5L9 18.5H5.5V15z" /></>,
  eye: <><path d="M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12z" /><circle cx="12" cy="12" r="2.75" /></>,
  tag: <><path d="M4 12.6V5a1 1 0 0 1 1-1h7.6l7.4 7.4a1 1 0 0 1 0 1.4l-6.6 6.6a1 1 0 0 1-1.4 0z" /><circle cx="8.5" cy="8.5" r="1.25" /></>,
  scooter: <><circle cx="6" cy="17.5" r="2.25" /><circle cx="18" cy="17.5" r="2.25" /><path d="M8.25 17.5h7.5l-2-8.5H16M13.75 9 11 6.5H9" /><path d="M18 17.5 16.5 9" /></>,
  chat: <><path d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8z" /></>,
  phone: <><path d="M6.5 4.5h3l1.5 4-2 1.25a9 9 0 0 0 5.25 5.25L15.5 13l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.6 18.5 5.5 13.4 5 6.1a1.5 1.5 0 0 1 1.5-1.6z" /></>,
  cutlery: <><path d="M7.5 4v7M5.5 4v4.5a2 2 0 0 0 4 0V4M7.5 11v9M16.5 20V4c-2 1-3 3.5-3 6.5V13h3" /></>,
  refresh: <><path d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4" /></>,
  settings: <><circle cx="12" cy="12" r="2.75" /><path d="M12 3.75v2.5M12 17.75v2.5M3.75 12h2.5M17.75 12h2.5M6.2 6.2l1.75 1.75M16.05 16.05l1.75 1.75M6.2 17.8l1.75-1.75M16.05 7.95l1.75-1.75" /></>,
  logout: <><path d="M14 5H6.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1H14M10.5 12h9M16.5 8.5 20 12l-3.5 3.5" /></>,
  store: <><path d="M4.5 9.5 6 5h12l1.5 4.5M4.5 9.5h15M4.5 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M6 12v7h12v-7" /></>,
  list: <><path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" /></>,
  map: <><path d="m9 5-5 2v12l5-2 6 2 5-2V5l-5 2z" /><path d="M9 5v12M15 7v12" /></>,
  chart: <><path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" /></>,
  arrowUp: <><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></>,
  arrowDown: <><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" /></>,
  sort: <><path d="M8 5v14M4.5 8.5 8 5l3.5 3.5M16 19V5M12.5 15.5 16 19l3.5-3.5" /></>,
  bolt: <><path d="M13 3.5 6 13.5h5.5l-1 7 7-10H12z" /></>,
  navigation: <><path d="m4.5 11 15-6.5-6.5 15-1.75-6.75z" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 13h16M12 9v11M12 9c-1.5-3.5-5.5-3.5-5.5-1S9 9 12 9zm0 0c1.5-3.5 5.5-3.5 5.5-1S15 9 12 9z" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  door: <><path d="M6 20V4.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V20M4 20h16M14.5 12.5h.01" /></>,
  flame: <><path d="M12 20.5c3.6 0 6-2.4 6-5.8 0-3.7-3-6-4.4-9.2-1 2.6-2.6 3.6-3.4 4.2-.6-1-1-2-1-3C7.2 8.8 6 11.6 6 14.7c0 3.4 2.4 5.8 6 5.8z" /></>,
  leaf: <><path d="M5 19c0-8 5-13.5 14-14 .4 9-5 14-11 14H5zM5 19l7-7" /></>,
  spark: <><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5" /></>,
};

export type IconName = keyof typeof P;

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name' | 'stroke'> { name: IconName; size?: number; filled?: boolean; stroke?: number }

export function Icon({ name, size = 22, filled, stroke = 1.75, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {P[name]}
    </svg>
  );
}
