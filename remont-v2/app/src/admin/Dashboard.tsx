import { api, STATUS_LABELS, isHot } from '../api';
import { Icon } from '../components/Icon';
import { useApi } from '../lib/hooks';
import { dayWord, rub, timeAgo, short } from '../lib/format';
import { AdmHead } from './AdminApp';

export function Dashboard({ go }: { go: (r: string) => void }) {
  const { data: st } = useApi(() => api.leads.stats(), [], ['leads', 'bookings']);
  const { data: recent } = useApi(() => api.leads.list(), [], ['leads']);
  const max = Math.max(1, ...(st?.bySource.map((s) => s.count) ?? [1]));
  return (
    <div className="adm-page">
      <AdmHead title="Обзор" sub="Что происходит с заявками и замерами" />
      <div className="kpis">
        <button className="kpi" onClick={() => go('leads')}><span className="kpi-k mono">Новых сегодня</span><span className="kpi-v display num">{st?.newToday ?? '—'}</span></button>
        <button className="kpi" onClick={() => go('calendar')}><span className="kpi-k mono">Замеров на неделе</span><span className="kpi-v display num">{st?.measurementsWeek ?? '—'}</span></button>
        <div className="kpi"><span className="kpi-k mono">Средняя смета</span><span className="kpi-v display num">{st ? short(st.avgEstimate) : '—'}</span></div>
        <button className="kpi kpi-hot" onClick={() => go('leads')}><span className="kpi-k mono"><Icon name="flame" size={14} /> Горячих</span><span className="kpi-v display num">{st?.hot ?? '—'}</span><span className="small">расчёт + замер</span></button>
      </div>

      <div className="adm-cols">
        <section className="adm-card">
          <h2 className="adm-h2">Заявки по источникам</h2>
          <p className="small muted">Какой инструмент сайта приводит клиентов. Всего заявок: {st?.total ?? '—'}</p>
          <ul className="bars" aria-label="Заявки по источникам">
            {st?.bySource.map((s) => (
              <li key={s.source} title={`${s.label}: ${s.count}`}>
                <span className="bars-l">{s.label}</span>
                <span className="bars-t"><span style={{ transform: `scaleX(${s.count / max})` }} /></span>
                <span className="num bars-v">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="adm-card">
          <h2 className="adm-h2">Ближайшие замеры</h2>
          {st && st.upcoming.length === 0 && <p className="muted small">Пока никто не записался. Как только появится запись — она будет здесь.</p>}
          <ul className="up">
            {st?.upcoming.map((u) => (
              <li key={u.leadId + u.date}>
                <button className="up-row" onClick={() => go(`leads/${u.leadId}`)}>
                  <span className="mono up-d">{dayWord(u.date)}, {u.time}</span>
                  <span>{u.name}</span>
                  {u.hot && <span className="tag tag-clay"><Icon name="flame" size={12} /> горячая</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head"><h2 className="adm-h2">Последние заявки</h2><button className="link small" onClick={() => go('leads')}>Все заявки</button></div>
        {recent && recent.length === 0 && <p className="muted">Заявок пока нет. Они появятся, когда посетители запишутся на замер или попросят смету.</p>}
        <ul className="lrows">
          {recent?.slice(0, 5).map((l) => (
            <li key={l.id}>
              <button className="lrow" onClick={() => go(`leads/${l.id}`)}>
                <span className="lrow-n mono">№{l.number}</span>
                <span className="lrow-name">{isHot(l) && <Icon name="flame" size={14} className="hot-ico" />}{l.name}</span>
                <span className={`st st-${l.status}`}>{STATUS_LABELS[l.status]}</span>
                <span className="num lrow-sum">{l.estimate ? rub(l.estimate.total) : '—'}</span>
                <span className="small muted lrow-ago">{timeAgo(l.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
