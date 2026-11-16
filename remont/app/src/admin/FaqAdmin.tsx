import { useState } from 'react';
import { api, type FaqItem } from '../api';
import { Icon } from '../components/Icon';
import { Modal, Segmented, Spinner, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { AdmHead } from './AdminApp';

export function FaqAdmin() {
  const [group, setGroup] = useState<FaqItem['group']>('faq');
  const { data: list } = useApi(() => api.faq.list(group, { all: true }), [group], ['faq']);
  const [edit, setEdit] = useState<FaqItem | null>(null);
  const toast = useToast();
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok, 'ok'); } catch (e) { toast(humanError(e), 'warn'); } };

  return (
    <div className="adm-page">
      <AdmHead title="FAQ и гарантии" sub="Ответы на вопросы, которые клиенты задают менеджерам каждый день.">
        <button className="btn btn-s btn-primary" onClick={() => setEdit({ id: '', group, q: '', a: '', enabled: true, order: 0 })}><Icon name="plus" size={16} /> Добавить</button>
      </AdmHead>
      <Segmented label="Раздел" value={group} options={[{ value: 'faq', label: 'Вопросы' }, { value: 'guarantee', label: 'Гарантии' }]} onChange={setGroup} className="adm-seg" />
      {list && list.length === 0 && <div className="adm-empty"><Icon name="info" size={28} /><b>Пока пусто</b><p className="small muted">Добавьте первый пункт — он сразу появится на сайте.</p></div>}
      <ul className="crud">
        {list?.map((f, i) => (
          <li key={f.id} className={`crud-row${f.enabled ? '' : ' disabled'}`}>
            <div className="crud-ord">
              <button className="icon-btn" disabled={i === 0} onClick={() => run(() => api.faq.move(f.id, -1))} aria-label="Выше"><Icon name="up" size={16} /></button>
              <button className="icon-btn" disabled={i === list.length - 1} onClick={() => run(() => api.faq.move(f.id, 1))} aria-label="Ниже"><Icon name="down" size={16} /></button>
            </div>
            <div className="crud-main"><b>{f.q}</b><span className="small muted crud-clip">{f.a}</span></div>
            <div className="crud-act">
              <button className="toggle-mini" role="switch" aria-checked={f.enabled} onClick={() => run(() => api.faq.save({ ...f, enabled: !f.enabled }))} aria-label={f.enabled ? 'Скрыть' : 'Показать'}><span className="sw" /></button>
              <button className="icon-btn" onClick={() => setEdit(f)} aria-label="Изменить"><Icon name="edit" size={16} /></button>
              <button className="icon-btn" onClick={() => { if (window.confirm('Удалить этот пункт?')) run(() => api.faq.remove(f.id), 'Удалено'); }} aria-label="Удалить"><Icon name="trash" size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Изменить' : 'Новый пункт'}>
        {edit && <FaqForm initial={edit} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

function FaqForm({ initial, onDone }: { initial: FaqItem; onDone: () => void }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.faq.save(f); onDone(); } catch (ex) { setErr(humanError(ex)); } finally { setBusy(false); }
  };
  return (
    <form className="pform" onSubmit={save}>
      <label className="field"><span>{f.group === 'faq' ? 'Вопрос' : 'Гарантия'}</span><input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} data-autofocus /></label>
      <label className="field"><span>{f.group === 'faq' ? 'Ответ' : 'Пояснение'}</span><textarea className="input" rows={5} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={18} />} Сохранить</button>
    </form>
  );
}
