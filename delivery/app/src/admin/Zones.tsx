import { useEffect, useState } from 'react';
import { api, toFriendly, type Point, type Zone, type ZoneInput } from '../api';
import { useQuery } from '../lib/useQuery';
import { Button, ErrorState, Skeleton, Toggle } from '../components/ui';
import { Sheet, Confirm } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { CityMap } from '../components/CityMap';
import { useToast } from '../components/Toast';
import { AdminPage, F, NumInput, Pill } from './kit';
import { rub } from '../lib/format';

const blank = (): ZoneInput => ({ name: '', description: '', surcharge: 100, extraMinutes: 15, polygon: [], enabled: true });

function ZoneForm({ open, initial, all, onClose }: { open: boolean; initial: Zone | null; all: Zone[]; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<ZoneInput>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); if (initial) { const { id: _i, sort: _s, ...rest } = initial; setF(JSON.parse(JSON.stringify(rest))); } else setF(blank()); } }, [open, initial]);
  const set = <K extends keyof ZoneInput>(k: K, v: ZoneInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null);
    try { await api.admin.zones.save(f, initial?.id); toast({ text: 'Зона сохранена — цены доставки пересчитаны', tone: 'success' }); onClose(); }
    catch (e) { setError(toFriendly(e).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={initial ? initial.name : 'Новая зона'} size="tall"
      footer={<div className="filters-footer"><Button variant="quiet" size="lg" onClick={onClose}>Отмена</Button><Button size="lg" block loading={busy} onClick={save}>Сохранить</Button></div>}>
      <div className="a-form">
        {error && <p className="a-form__error" role="alert"><Icon name="info" size={16} /> {error}</p>}
        <F label="Название" wide><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Например, Бор" /></F>
        <F label="Надбавка к доставке" hint="Прибавляется к базовой цене ресторана"><NumInput value={f.surcharge} onChange={(v) => set('surcharge', Number(v))} suffix="₽" /></F>
        <F label="Дополнительное время"><NumInput value={f.extraMinutes} onChange={(v) => set('extraMinutes', Number(v))} suffix="мин" /></F>
        <F label="Описание" wide><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Какие районы входят" /></F>
        <div className="a-field a-field--wide">
          <span className="field__label">Граница зоны — нажимайте на карту, чтобы ставить точки ({f.polygon.length})</span>
          <div className="a-map a-map--tall">
            <CityMap label="Редактор границы зоны" zones={all.filter((z) => z.id !== initial?.id)} draft={f.polygon} onPick={(p: Point) => set('polygon', [...f.polygon, p])} />
          </div>
          <div className="choice-row">
            <Button type="button" size="sm" variant="secondary" icon="back" disabled={!f.polygon.length} onClick={() => set('polygon', f.polygon.slice(0, -1))}>Убрать точку</Button>
            <Button type="button" size="sm" variant="quiet" icon="trash" disabled={!f.polygon.length} onClick={() => set('polygon', [])}>Очистить</Button>
          </div>
        </div>
        <label className="filter-toggle a-field--wide"><span><b>Зона активна</b><span className="muted t-sm">Выключенная зона не принимает заказы</span></span><Toggle checked={f.enabled} onChange={(v) => set('enabled', v)} label="Зона активна" /></label>
      </div>
    </Sheet>
  );
}

export function ZonesAdmin() {
  const toast = useToast();
  const q = useQuery(() => api.admin.zones.list(), [], ['settings', 'catalog']);
  const [edit, setEdit] = useState<{ open: boolean; z: Zone | null }>({ open: false, z: null });
  const [remove, setRemove] = useState<Zone | null>(null);
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast({ text: msg, tone: 'success' }), (e) => toast({ text: toFriendly(e).message, tone: 'danger' }));
  const zones = q.data ?? [];
  return (
    <AdminPage title="Зоны доставки" sub="Цена доставки = базовая цена ресторана + надбавка зоны. При пересечении действует зона выше в списке." actions={<Button icon="plus" onClick={() => setEdit({ open: true, z: null })}>Новая зона</Button>}>
      {q.error && <ErrorState message={q.error.message} onRetry={q.reload} />}
      <div className="a-grid-2 a-grid-2--zones">
        <section className="a-card a-map a-map--tall">{q.loading ? <Skeleton h="100%" /> : <CityMap label="Все зоны доставки" zones={zones} />}</section>
        <ul className="a-list a-card">
          {zones.map((z) => (
            <li key={z.id} className="a-list__row">
              <span className="a-list__main"><b>{z.name}</b><span className="muted t-sm">{z.surcharge ? `+${rub(z.surcharge)}` : 'без надбавки'} · {z.extraMinutes ? `+${z.extraMinutes} мин` : 'без доп. времени'}{z.description ? ` · ${z.description}` : ''}</span></span>
              {z.enabled ? <Pill tone="success">Активна</Pill> : <Pill>Выключена</Pill>}
              <Toggle checked={z.enabled} label={`Зона «${z.name}» активна`} onChange={(v) => run(api.admin.zones.setEnabled(z.id, v), v ? `«${z.name}» включена` : `«${z.name}» выключена`)} />
              <button className="icon-btn icon-btn--sm" aria-label={`Изменить «${z.name}»`} onClick={() => setEdit({ open: true, z })}><Icon name="edit" size={17} /></button>
              <button className="icon-btn icon-btn--sm" aria-label={`Удалить «${z.name}»`} onClick={() => setRemove(z)}><Icon name="trash" size={17} /></button>
            </li>
          ))}
        </ul>
      </div>
      <ZoneForm open={edit.open} initial={edit.z} all={zones} onClose={() => setEdit({ open: false, z: null })} />
      <Confirm open={!!remove} title={`Удалить зону «${remove?.name}»?`} text="Адреса в этой зоне перестанут обслуживаться." confirmLabel="Удалить" danger onConfirm={() => { const z = remove!; setRemove(null); run(api.admin.zones.remove(z.id), 'Зона удалена'); }} onClose={() => setRemove(null)} />
    </AdminPage>
  );
}
