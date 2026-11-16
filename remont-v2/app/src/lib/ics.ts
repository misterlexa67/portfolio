/** Файл .ics для «Добавить в календарь». Время — локальное (Нижний Новгород, UTC+3). */
export function downloadIcs(o: { date: string; time: string; title: string; description: string; location?: string; minutes?: number }) {
  const [y, m, d] = o.date.split('-').map(Number);
  const [hh, mm] = o.time.split(':').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, hh - 3, mm));
  const end = new Date(start.getTime() + (o.minutes ?? 60) * 60000);
  const f = (x: Date) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Metr demo//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${Date.now()}@metr.demo`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${esc(o.title)}`, `DESCRIPTION:${esc(o.description)}`, o.location ? `LOCATION:${esc(o.location)}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Скоро замер', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'zamer-metr.ics';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
