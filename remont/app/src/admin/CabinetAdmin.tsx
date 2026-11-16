import { useEffect, useState } from 'react';
import { api, cabinetSummary, type CabinetClient, type CabinetStage } from '../api';
import { Icon } from '../components/Icon';
import { Spinner, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { dateTime, rub } from '../lib/format';
import { AdmHead } from './AdminApp';

const ST: { v: CabinetStage['status']; l: string }[] = [{ v: 'done', l: 'Готово' }, { v: 'current', l: 'Идёт' }, { v: 'next', l: 'Дальше' }];

export function CabinetAdmin() {
  const { data } = useApi(() => api.cabinet.get(), [], ['cabinet']);
  const [c, setC] = useState<CabinetClient | null>(null);
  const [msg, setMsg] = useState('');
  const [author, setAuthor] = useState('Игорь, прораб');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (data) setC(data); }, [data]);
  if (!c || !data) return <div className="adm-page muted">Загружаем кабинет…</div>;
  const dirty = JSON.stringify(c) !== JSON.stringify(data);
  const s = cabinetSummary(c);

  const save = async () => {
    setBusy(true);
    try { await api.cabinet.save(c); toast('Кабинет клиента обновлён', 'ok'); } catch (e) { toast(humanError(e), 'warn'); } finally { setBusy(false); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.cabinet.addUpdate(msg, author); setMsg(''); toast('Сообщение появилось в кабинете клиента', 'ok'); } catch (ex) { toast(humanError(ex), 'warn'); }
  };
  const setStage = (i: number, patch: Partial<CabinetStage>) => setC({ ...c, stages: c.stages.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="adm-page">
      <AdmHead title="Кабинет клиента" sub={`${c.clientName} · ${c.address}`}>
        <a className="btn btn-s btn-ghost" href="../cabinet/" target="_blank" rel="noopener"><Icon name="external" size={16} /> Открыть кабинет</a>
        <button className="btn btn-s btn-primary" onClick={save} disabled={!dirty || busy}>{busy ? <Spinner /> : <Icon name="check" size={16} />} Сохранить</button>
      </AdmHead>
      <p className="small muted">Общий прогресс: <b className="num">{s.progress}%</b> · оплачено <span className="num">{rub(s.paid)}</span> из <span className="num">{rub(c.contractTotal)}</span></p>

      <section className="adm-card">
        <h2 className="adm-h2">Этапы</h2>
        <ul className="stg">
          {c.stages.map((st, i) => (
            <li key={st.id} className="stg-row">
              <b>{st.title}</b>
              <div className="chips">{ST.map((o) => <button key={o.v} className="chip" aria-pressed={st.status === o.v} onClick={() => setStage(i, { status: o.v, progress: o.v === 'done' ? 100 : o.v === 'next' ? 0 : st.progress })}>{o.l}</button>)}</div>
              <label className="nf stg-p"><span>Прогресс: {st.progress}%</span>
                <input type="range" className="range" min={0} max={100} step={5} value={st.progress} style={{ '--p': `${st.progress}%` } as React.CSSProperties} onChange={(e) => setStage(i, { progress: Number(e.target.value) })} />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-card">
        <h2 className="adm-h2">Платежи</h2>
        <ul className="crud">
          {c.payments.map((p, i) => (
            <li key={p.id} className="crud-row">
              <div className="crud-main"><b>{p.label}</b><span className="small muted num">{rub(p.amount)}</span></div>
              <div className="crud-act">
                <span className="small muted">{p.paid ? 'оплачен' : 'ожидается'}</span>
                <button className="toggle-mini" role="switch" aria-checked={p.paid} onClick={() => setC({ ...c, payments: c.payments.map((x, j) => (j === i ? { ...x, paid: !x.paid } : x)) })} aria-label="Оплачен"><span className="sw" /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-card">
        <h2 className="adm-h2">Сообщения клиенту</h2>
        <form className="pform" onSubmit={send}>
          <label className="field"><span>От кого</span><input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
          <label className="field"><span>Сообщение</span><textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Например: плитку в ванной закончили, завтра затирка" /></label>
          <button className="btn btn-s btn-primary" disabled={!msg.trim()}><Icon name="send" size={16} /> Опубликовать в кабинете</button>
        </form>
        <ul className="notes">
          {[...c.updates].reverse().map((u) => (
            <li key={u.id}>
              <span className="mono">{dateTime(u.at)} · {u.author}</span>
              <p>{u.text}</p>
              <button className="link small" onClick={() => setC({ ...c, updates: c.updates.filter((x) => x.id !== u.id) })}>Удалить (сохраните изменения)</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
