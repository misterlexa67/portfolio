import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, STATUS_LABEL, type AdminStats } from '../api';
import { useQuery } from '../lib/useQuery';
import { ErrorState, Skeleton } from '../components/ui';
import { AdminPage, Pill } from './kit';
import { rub, when } from '../lib/format';

/** Один ряд данных — один цвет, без легенды; подсказка при наведении; таблица для скринридеров. */
function HourlyChart({ data }: { data: AdminStats['hourly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const from = Math.max(0, data.length - 14);
  const rows = data.slice(from);
  const max = Math.max(1, ...rows.map((r) => r.orders));
  const W = 560, H = 180, padB = 22, padT = 26, padL = 22;
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const bw = (W - padL) / rows.length;
  const yOf = (v: number) => H - padB - ((H - padB - padT) * v) / top;
  const h = hover !== null ? rows[hover] : null;
  return (
    <figure className="a-chart">
      <figcaption className="a-chart__title">Заказы по часам, сегодня</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Количество заказов по часам за сегодня" onMouseLeave={() => setHover(null)}>
        {[top / 2, top].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={yOf(v)} y2={yOf(v)} className="a-chart__grid" />
            <text x={0} y={yOf(v) + 3} className="a-chart__ylab">{v}</text>
          </g>
        ))}
        <line x1={padL} x2={W} y1={H - padB} y2={H - padB} className="a-chart__axis" />
        <text x={0} y={H - padB + 3} className="a-chart__ylab">0</text>
        {rows.map((r, i) => {
          const bh = r.orders ? Math.max(4, H - padB - yOf(r.orders)) : 0;
          const x = padL + i * bw + 1;
          const y = H - padB - bh;
          const w = bw - 2; // 2px зазор между столбиками
          return (
            <g key={r.hour} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${r.hour}:00 — ${r.orders} заказов`}>
              <rect x={padL + i * bw} y={0} width={bw} height={H - padB} fill="transparent" />
              {bh > 0 && <path d={`M${x},${H - padB} V${y + 4} q0,-4 4,-4 H${x + w - 4} q4,0 4,4 V${H - padB} Z`} className={`a-chart__bar${hover === i ? ' is-hover' : ''}${i === rows.length - 1 ? ' is-now' : ''}`} />}
              {(i % 2 === (rows.length - 1) % 2 || rows.length < 8) && <text x={padL + i * bw + bw / 2} y={H - 6} className="a-chart__tick">{i === rows.length - 1 ? 'сейчас' : String(r.hour).padStart(2, '0')}</text>}
            </g>
          );
        })}
        {h && hover !== null && (
          <g transform={`translate(${Math.min(W - 120, Math.max(0, padL + hover * bw + bw / 2 - 60))} 0)`} className="a-chart__tip" pointerEvents="none">
            <rect width={120} height={22} rx={6} />
            <text x={60} y={15}>{String(h.hour).padStart(2, '0')}:00 · {h.orders} · {rub(h.revenue)}</text>
          </g>
        )}
      </svg>
      <table className="sr-only">
        <caption>Заказы по часам</caption>
        <thead><tr><th>Час</th><th>Заказов</th><th>Выручка</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.hour}><td>{r.hour}:00</td><td>{r.orders}</td><td>{rub(r.revenue)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function Dashboard() {
  const stats = useQuery(() => api.admin.stats(), [], ['orders', 'catalog']);
  const recent = useQuery(() => api.admin.orders.list(), [], ['orders']);
  useEffect(() => {
    const t = setInterval(() => { stats.reload(); recent.reload(); }, 4000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = stats.data;
  const tiles = s ? [
    { label: 'Заказов сегодня', value: String(s.ordersToday) },
    { label: 'Выручка, демо ₽', value: rub(s.revenueToday) },
    { label: 'Средний чек', value: rub(s.averageCheck) },
    { label: 'Активные заказы', value: String(s.activeOrders), accent: s.activeOrders > 0 },
  ] : [];

  return (
    <AdminPage title="Обзор" sub="Сегодня по московскому времени. Данные обновляются автоматически.">
      {stats.error && <ErrorState message={stats.error.message} onRetry={stats.reload} />}
      <div className="a-tiles">
        {!s && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={96} r={20} />)}
        {tiles.map((t) => (
          <div key={t.label} className={`a-tile${t.accent ? ' is-accent' : ''}`}>
            <span className="a-tile__label">{t.label}</span>
            <span className="a-tile__value num">{t.value}</span>
          </div>
        ))}
      </div>
      <div className="a-grid-2">
        <section className="a-card">{s ? <HourlyChart data={s.hourly} /> : <Skeleton h={200} />}</section>
        <section className="a-card">
          <h2 className="a-card__title">Популярное сегодня</h2>
          {s && !s.topDishes.length && <p className="muted">Пока нет заказов за сегодня.</p>}
          <ol className="a-top">
            {s?.topDishes.map((d, i) => <li key={d.name}><span className="a-top__n num">{i + 1}</span><span className="a-top__name">{d.name}</span><span className="num muted">{d.qty} шт</span></li>)}
          </ol>
        </section>
      </div>
      <section className="a-card">
        <div className="a-card__head">
          <h2 className="a-card__title">Последние заказы</h2>
          <Link to="/admin/orders" className="link">Все заказы</Link>
        </div>
        <ul className="a-list">
          {recent.data?.slice(0, 6).map((o) => (
            <li key={o.id} className="a-list__row">
              <span className="a-list__main"><b>№{o.number} · {o.restaurant.name}</b><span className="muted t-sm">{o.customer.own ? 'Вы (демо-клиент)' : o.customer.name} · {when(o.createdAt)}</span></span>
              <Pill tone={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'danger' : 'accent'}>{STATUS_LABEL[o.status]}</Pill>
              <span className="price a-list__sum">{rub(o.totals.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </AdminPage>
  );
}
