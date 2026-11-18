import { useMemo, useState } from 'react';
import { api, catalog, describeParams, isHot, LEAD_STATUSES, STATUS_LABELS, SOURCE_LABELS, type Lead, type LeadStatus } from '../api';
import { layersFor } from '../api/pricing';
import { IsoApartment } from '../components/iso/IsoApartment';
import { Icon } from '../components/Icon';
import { Segmented, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { dateLong, dateTime, rub, timeAgo, telHref, weeks } from '../lib/format';
import { AdmHead } from './AdminApp';

type Filter = LeadStatus | 'all' | 'hot';

export function Leads({ id, go }: { id?: string; go: (r: string) => void }) {
  if (id) return <LeadCard id={id} go={go} />;
  return <LeadList go={go} />;
}

function LeadList({ go }: { go: (r: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const { data: all } = useApi(() => api.leads.list(), [], ['leads']);
  const toast = useToast();
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all?.length ?? 0, hot: all?.filter(isHot).length ?? 0 };
    LEAD_STATUSES.forEach((s) => { c[s] = all?.filter((l) => l.status === s).length ?? 0; });
    return c;
  }, [all]);
  const list = (all ?? [])
    .filter((l) => filter === 'all' || (filter === 'hot' ? isHot(l) : l.status === filter))
    .filter((l) => !q || `${l.name} ${l.phone} ${l.number}`.toLowerCase().includes(q.toLowerCase()));

  const exportCsv = async () => {
    const csv = await api.leads.exportCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `zayavki-metr-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('CSV выгружен — откроется в Excel', 'ok');
  };
  const clear = async () => {
    if (!window.confirm('Удалить все заявки и записи на замер? Их можно вернуть кнопкой «Сброс».')) return;
    await api.leads.clearAll();
  };

  return (
    <div className="adm-page">
      <AdmHead title="Заявки" sub="Горячие — с полным расчётом и записью на замер — всегда сверху">
        <button className="btn btn-s btn-ghost" onClick={exportCsv} disabled={!all?.length}><Icon name="csv" size={16} /> Экспорт CSV</button>
        <button className="btn btn-s btn-quiet" onClick={clear} disabled={!all?.length}><Icon name="trash" size={16} /> Очистить</button>
      </AdmHead>
      <div className="adm-filters">
        <input className="input adm-search" placeholder="Имя, телефон или номер" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск заявок" />
        <div className="chips adm-chips" role="radiogroup" aria-label="Статус">
          {(['all', 'hot', ...LEAD_STATUSES] as Filter[]).map((f) => (
            <button key={f} className="chip" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}>
              {f === 'hot' && <Icon name="flame" size={14} />}{f === 'all' ? 'Все' : f === 'hot' ? 'Горячие' : STATUS_LABELS[f]} <span className="chip-c num">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      {all && all.length === 0 && (
        <div className="adm-empty"><Icon name="list" size={28} /><b>Заявок пока нет</b><p className="small muted">Они появятся, когда посетитель запишется на замер или попросит смету в Telegram. Вернуть исходные заявки — кнопка «Сброс» вверху.</p></div>
      )}
      {all && all.length > 0 && list.length === 0 && <p className="muted adm-empty-s">По этому фильтру заявок нет.</p>}
      <ul className="lcards">
        {list.map((l) => (
          <li key={l.id}>
            <button className={`lcard${isHot(l) ? ' hot' : ''}`} onClick={() => go(`leads/${l.id}`)}>
              <span className="lc-top">
                <span className="mono">№{l.number} · {timeAgo(l.createdAt)}</span>
                <span className={`st st-${l.status}`}>{STATUS_LABELS[l.status]}</span>
              </span>
              <span className="lc-name">{isHot(l) && <Icon name="flame" size={16} className="hot-ico" />}{l.name} <span className="num muted">{l.phone}</span></span>
              <span className="small muted">{l.params ? describeParams(l.params) : 'Без расчёта'} · {SOURCE_LABELS[l.source]}</span>
              <span className="lc-bottom">
                <span className="num lc-sum">{l.estimate ? rub(l.estimate.total) : '—'}</span>
                {l.slot && <span className="tag"><Icon name="calendar" size={12} /> {dateLong(l.slot.date)}, {l.slot.time}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeadCard({ id, go }: { id: string; go: (r: string) => void }) {
  const { data: l, error, setData } = useApi(() => api.leads.get(id), [id], ['leads']);
  const toast = useToast();
  const [note, setNote] = useState('');
  const [channel, setChannel] = useState<'telegram' | 'max'>('telegram');
  if (error) return <div className="adm-page"><button className="link" onClick={() => go('leads')}>← Все заявки</button><p className="err">{error}</p></div>;
  if (!l) return <div className="adm-page muted">Загружаем заявку…</div>;

  const setStatus = async (s: LeadStatus) => {
    try { setData(await api.leads.updateStatus(l.id, s)); toast(`Статус: ${STATUS_LABELS[s]}`, 'ok'); } catch (e) { toast(humanError(e), 'warn'); }
  };
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try { setData(await api.leads.addNote(l.id, note)); setNote(''); } catch (ex) { toast(humanError(ex), 'warn'); }
  };
  const cancel = async () => {
    if (!window.confirm('Отменить запись на замер? Слот снова станет свободным.')) return;
    await api.slots.cancelBooking(l.id);
    toast('Запись отменена, слот освобождён', 'ok');
  };

  return (
    <div className="adm-page lead">
      <button className="link small" onClick={() => go('leads')}>← Все заявки</button>
      <header className="lead-head">
        <div>
          <span className="mono small muted">№{l.number} · {dateTime(l.createdAt)} · {SOURCE_LABELS[l.source]}</span>
          <h1 className="display">{isHot(l) && <Icon name="flame" size={26} className="hot-ico" />}{l.name}</h1>
          <span className="num lead-phone">{l.phone}</span>
        </div>
        <div className="lead-call">
          <a className="btn btn-primary" href={telHref(l.phone)}><Icon name="phone" size={18} /> Позвонить</a>
          <button className="btn btn-ghost" onClick={() => toast(`Здесь откроется чат с ${l.name} в мессенджере.`)}><Icon name="chat" size={18} /> Написать</button>
        </div>
      </header>

      <section className="adm-card">
        <h2 className="adm-h2">Статус</h2>
        <div className="chips st-chips" role="radiogroup" aria-label="Статус заявки">
          {LEAD_STATUSES.map((s) => <button key={s} className="chip" role="radio" aria-checked={l.status === s} onClick={() => setStatus(s)}>{STATUS_LABELS[s]}</button>)}
        </div>
        {l.slot && (
          <div className="lead-slot">
            <Icon name="calendar" size={18} />
            <span>Замер: <b>{dateLong(l.slot.date)}, {l.slot.time}</b></span>
            <button className="link small" onClick={cancel}>Отменить запись</button>
          </div>
        )}
      </section>

      {l.params && l.estimate ? <LeadCalc lead={l} /> : (
        <section className="adm-card"><h2 className="adm-h2">Расчёт</h2><p className="muted small">Клиент записался без расчёта. Посчитайте на замере.</p></section>
      )}

      <div className="adm-cols">
        <section className="adm-card">
          <h2 className="adm-h2">Заметки</h2>
          {l.notes.length === 0 && <p className="small muted">Пока нет заметок.</p>}
          <ul className="notes">{l.notes.map((n) => <li key={n.id}><span className="mono">{dateTime(n.at)}</span><p>{n.text}</p></li>)}</ul>
          <form className="note-form" onSubmit={addNote}>
            <textarea className="input" placeholder="Например: перезвонить после 18:00" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Новая заметка" />
            <button className="btn btn-s btn-primary" disabled={!note.trim()}>Добавить заметку</button>
          </form>
        </section>
        <section className="adm-card">
          <h2 className="adm-h2">Уведомление владельцу</h2>
          <Segmented label="Мессенджер" value={channel} options={[{ value: 'telegram', label: 'Telegram' }, { value: 'max', label: 'MAX' }]} onChange={setChannel} />
          <div className={`notif notif-${channel}`}>
            <span className="mono notif-from">{channel === 'telegram' ? 'Метр · бот заявок' : 'MAX · Метр заявки'}</span>
            <pre>{api.leads.notificationText(l)}</pre>
          </div>
          <p className="small muted"><Icon name="info" size={14} /> Так выглядит сообщение в {channel === 'telegram' ? 'Telegram' : 'MAX'}.</p>
        </section>
      </div>
    </div>
  );
}

function LeadCalc({ lead }: { lead: Lead }) {
  const p = lead.params!; const e = lead.estimate!;
  const plan = useMemo(() => api.plans.forParams(p), [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const layers = useMemo(() => layersFor(p), [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="adm-card lead-calc">
      <div className="adm-card-head"><h2 className="adm-h2">Расчёт, как его видел клиент</h2><span className="mono small muted">цены версии {e.priceVersion}</span></div>
      <div className="lc-grid">
        <div className="lc-iso"><IsoApartment plan={plan} layers={layers} level={p.level} assembled detail="low" stagger={60} /></div>
        <div>
          <p className="lc-params">{describeParams(p)}</p>
          <p className="small muted">Санузлов: {p.bathrooms} · Опции: {p.options.length ? p.options.map((o) => catalog.options.find((x) => x.id === o)!.name).join(', ') : 'нет'}</p>
          <table className="lc-table">
            <tbody>
              {e.lines.map((x) => <tr key={x.id}><th scope="row">{x.title}</th><td className="num">{rub(x.amount)}</td></tr>)}
              <tr className="lc-total"><th scope="row">Итого</th><td className="num">{rub(e.total)}</td></tr>
            </tbody>
          </table>
          <p className="small muted num">{rub(e.perM2)}/м² · {weeks(e.weeks.min, e.weeks.max)}</p>
        </div>
      </div>
    </section>
  );
}
