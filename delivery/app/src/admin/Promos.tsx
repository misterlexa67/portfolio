import { useEffect, useState } from 'react';
import { api, toFriendly, type PromoCode, type PromoInput } from '../api';
import { useQuery } from '../lib/useQuery';
import { Button, ErrorState, Segmented, Skeleton, Toggle } from '../components/ui';
import { Sheet, Confirm } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AdminPage, F, NumInput, Pill } from './kit';
import { rub } from '../lib/format';

const blank = (): PromoInput => ({ code: '', kind: 'percent', value: 10, minSubtotal: 0, maxDiscount: null, description: '', enabled: true });

function PromoForm({ open, initial, onClose }: { open: boolean; initial: PromoCode | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<PromoInput>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); if (initial) { const { id: _i, ...rest } = initial; setF({ ...rest }); } else setF(blank()); } }, [open, initial]);
  const set = <K extends keyof PromoInput>(k: K, v: PromoInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null);
    try { await api.admin.promos.save(f, initial?.id); toast({ text: 'Промокод сохранён', tone: 'success' }); onClose(); }
    catch (e) { setError(toFriendly(e).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={initial ? `Промокод ${initial.code}` : 'Новый промокод'}
      footer={<div className="filters-footer"><Button variant="quiet" size="lg" onClick={onClose}>Отмена</Button><Button size="lg" block loading={busy} onClick={save}>Сохранить</Button></div>}>
      <div className="a-form">
        {error && <p className="a-form__error" role="alert"><Icon name="info" size={16} /> {error}</p>}
        <F label="Код" hint="Гости вводят его в корзине; регистр не важен" wide><input className="input a-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ВЕСНА15" /></F>
        <div className="a-field a-field--wide"><span className="field__label">Тип скидки</span><Segmented label="Тип скидки" value={f.kind} onChange={(kind) => set('kind', kind)} options={[{ value: 'percent', label: 'Процент' }, { value: 'fixed', label: 'Сумма' }]} /></div>
        <F label="Скидка"><NumInput value={f.value} onChange={(v) => set('value', Number(v))} suffix={f.kind === 'percent' ? '%' : '₽'} /></F>
        <F label="Заказ от"><NumInput value={f.minSubtotal} onChange={(v) => set('minSubtotal', Number(v))} suffix="₽" /></F>
        {f.kind === 'percent' && <F label="Не больше" hint="Пусто — без ограничения"><NumInput value={f.maxDiscount ?? ''} onChange={(v) => set('maxDiscount', v ? Number(v) : null)} suffix="₽" /></F>}
        <F label="Описание для гостя" wide><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Скидка 15% на весенние заказы" /></F>
        <label className="filter-toggle a-field--wide"><span><b>Действует</b><span className="muted t-sm">Выключенный код не применится</span></span><Toggle checked={f.enabled} onChange={(v) => set('enabled', v)} label="Действует" /></label>
      </div>
    </Sheet>
  );
}

export function PromosAdmin() {
  const toast = useToast();
  const q = useQuery(() => api.admin.promos.list(), [], ['settings', 'cart']);
  const [edit, setEdit] = useState<{ open: boolean; p: PromoCode | null }>({ open: false, p: null });
  const [remove, setRemove] = useState<PromoCode | null>(null);
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast({ text: msg, tone: 'success' }), (e) => toast({ text: toFriendly(e).message, tone: 'danger' }));
  return (
    <AdminPage title="Промокоды" actions={<Button icon="plus" onClick={() => setEdit({ open: true, p: null })}>Новый промокод</Button>}>
      {q.error && <ErrorState message={q.error.message} onRetry={q.reload} />}
      {q.loading && <Skeleton h={200} r={20} />}
      <ul className="a-list a-card">
        {q.data?.map((p) => (
          <li key={p.id} className="a-list__row">
            <span className="a-code-chip">{p.code}</span>
            <span className="a-list__main">
              <b>{p.kind === 'percent' ? `−${p.value}%` : `−${rub(p.value)}`}{p.maxDiscount ? `, до ${rub(p.maxDiscount)}` : ''}</b>
              <span className="muted t-sm">{p.minSubtotal ? `от ${rub(p.minSubtotal)} · ` : ''}{p.description || 'без описания'}</span>
            </span>
            {p.enabled ? <Pill tone="success">Действует</Pill> : <Pill>Выключен</Pill>}
            <Toggle checked={p.enabled} label={`Промокод ${p.code} действует`} onChange={(v) => run(api.admin.promos.setEnabled(p.id, v), v ? `${p.code} включён` : `${p.code} выключен`)} />
            <button className="icon-btn icon-btn--sm" aria-label={`Изменить ${p.code}`} onClick={() => setEdit({ open: true, p })}><Icon name="edit" size={17} /></button>
            <button className="icon-btn icon-btn--sm" aria-label={`Удалить ${p.code}`} onClick={() => setRemove(p)}><Icon name="trash" size={17} /></button>
          </li>
        ))}
      </ul>
      <PromoForm open={edit.open} initial={edit.p} onClose={() => setEdit({ open: false, p: null })} />
      <Confirm open={!!remove} title={`Удалить ${remove?.code}?`} confirmLabel="Удалить" danger onConfirm={() => { const p = remove!; setRemove(null); run(api.admin.promos.remove(p.id), 'Промокод удалён'); }} onClose={() => setRemove(null)} />
    </AdminPage>
  );
}
