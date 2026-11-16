import { useEffect, useState } from 'react';
import { api, type ScheduleSettings } from '../api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { dateLong } from '../lib/format';
import { AdmHead, NumField } from './AdminApp';

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function CalendarAdmin({ go }: { go: (r: string) => void }) {
  const toast = useToast();
  const { data: sched } = useApi(() => api.slots.getSchedule(), [], ['schedule']);
  const { data: days } = useApi(() => api.slots.getCalendar(), [], ['bookings', 'exceptions', 'schedule']);
  const { data: leads } = useApi(() => api.leads.list(), [], ['leads']);
  const [draft, setDraft] = useState<ScheduleSettings | null>(null);
  const [newTime, setNewTime] = useState('');
  useEffect(() => { if (sched) setDraft(sched); }, [sched]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast(ok, 'ok'); } catch (e) { toast(humanError(e), 'warn'); }
  };
  const nameOf = (id?: string) => leads?.find((l) => l.id === id)?.name ?? 'клиент';

  return (
    <div className="adm-page">
      <AdmHead title="Календарь замеров" sub="Слоты открыты по рабочим часам. Закрывайте только исключения: праздники, выходные, занятые дни." />
      {draft && (
        <section className="adm-card">
          <h2 className="adm-h2">Рабочие часы</h2>
          <span className="small muted">Рабочие дни</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} className="chip chip-num" aria-pressed={draft.workDays.includes(d)} onClick={() => setDraft({ ...draft, workDays: draft.workDays.includes(d) ? draft.workDays.filter((x) => x !== d) : [...draft.workDays, d] })}>{WD[d]}</button>
            ))}
          </div>
          <span className="small muted">Время начала замеров</span>
          <div className="chips">
            {draft.times.map((t) => (
              <button key={t} className="chip on" onClick={() => setDraft({ ...draft, times: draft.times.filter((x) => x !== t) })} aria-label={`Убрать ${t}`}>{t} <Icon name="close" size={14} /></button>
            ))}
            <span className="add-time">
              <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Новое время" />
              <button className="chip" disabled={!newTime} onClick={() => { setDraft({ ...draft, times: [...draft.times, newTime] }); setNewTime(''); }}><Icon name="plus" size={14} /> Добавить</button>
            </span>
          </div>
          <div className="nf-row">
            <NumField label="Показывать дней вперёд" value={draft.horizonDays} onChange={(n) => setDraft({ ...draft, horizonDays: n })} min={7} max={60} />
            <NumField label="Запись не ближе, чем за" value={draft.minLeadHours} onChange={(n) => setDraft({ ...draft, minLeadHours: n })} suffix="ч" max={72} />
          </div>
          <button className="btn btn-s btn-primary" onClick={() => run(() => api.slots.saveSchedule(draft), 'Рабочие часы сохранены')}>Сохранить часы</button>
        </section>
      )}

      <section className="adm-card">
        <h2 className="adm-h2">Дни и слоты</h2>
        <p className="small muted">Нажмите на время, чтобы закрыть или открыть его. Занятые слоты ведут в заявку.</p>
        <ul className="cal-days">
          {days?.map((d) => {
            const anyOpen = d.slots.some((s) => s.state !== 'closed');
            return (
              <li key={d.date} className={`cal-day${d.workday ? '' : ' off'}`}>
                <div className="cal-d">
                  <b>{dateLong(d.date)}</b>
                  <button className="link small" onClick={() => run(() => api.slots.setDay(d.date, !d.workday), d.workday ? 'День закрыт' : 'День открыт')}>
                    {d.workday ? 'Закрыть день' : 'Открыть день'}
                  </button>
                </div>
                <div className="cal-slots">
                  {d.slots.map((s) => s.state === 'booked' ? (
                    <button key={s.time} className="cslot booked" onClick={() => go(`leads/${s.leadId}`)} title="Открыть заявку">
                      <span className="num">{s.time}</span><span>{nameOf(s.leadId)}</span>
                    </button>
                  ) : (
                    <button key={s.time} className={`cslot ${s.state}`} onClick={() => run(() => api.slots.setSlot(d.date, s.time, s.state === 'closed'))} aria-label={`${s.time}: ${s.state === 'available' ? 'свободно, закрыть' : 'закрыто, открыть'}`}>
                      <span className="num">{s.time}</span><span>{s.state === 'available' ? 'свободно' : 'закрыто'}</span>
                    </button>
                  ))}
                  {!anyOpen && <span className="small muted">выходной</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
