import { useRef, useState } from 'react';
import { api, catalog, type Project, type OptionId } from '../api';
import { Icon } from '../components/Icon';
import { MapNN, districtName } from '../components/map/MapNN';
import { Modal, Segmented, Spinner, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { rub, area } from '../lib/format';
import { AdmHead, NumField } from './AdminApp';

const EMPTY: Project = {
  id: '', title: '', district: 'sovetsky', street: 'район ', house: 'panel90', rooms: 2, bathrooms: 1, area: 55, weeks: 12, price: 0,
  type: 'capital', level: 'standard', options: [], year: new Date().getFullYear(), x: 760, y: 450, enabled: true, order: 0, note: '',
};

export function ProjectsAdmin() {
  const { data: list } = useApi(() => api.projects.list({ all: true }), [], ['projects']);
  const [edit, setEdit] = useState<Project | null>(null);
  const toast = useToast();
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok, 'ok'); } catch (e) { toast(humanError(e), 'warn'); } };

  return (
    <div className="adm-page">
      <AdmHead title="Объекты на карте" sub="Порядок, видимость и данные примеров. Выключенный объект пропадает с карты сайта.">
        <button className="btn btn-s btn-primary" onClick={() => setEdit({ ...EMPTY })}><Icon name="plus" size={16} /> Добавить объект</button>
      </AdmHead>
      {list && list.length === 0 && <div className="adm-empty"><Icon name="pin" size={28} /><b>Объектов пока нет</b><p className="small muted">Добавьте первый — он появится на карте сайта.</p></div>}
      <ul className="crud">
        {list?.map((p, i) => (
          <li key={p.id} className={`crud-row${p.enabled ? '' : ' disabled'}`}>
            <div className="crud-ord">
              <button className="icon-btn" disabled={i === 0} onClick={() => run(() => api.projects.move(p.id, -1))} aria-label="Выше"><Icon name="up" size={16} /></button>
              <button className="icon-btn" disabled={i === list.length - 1} onClick={() => run(() => api.projects.move(p.id, 1))} aria-label="Ниже"><Icon name="down" size={16} /></button>
            </div>
            <div className="crud-main">
              <b>{p.title}</b>
              <span className="small muted">{districtName(p.district)} · {catalog.houseTypes.find((h) => h.id === p.house)?.name}, {area(p.area)} · <span className="num">{rub(p.price)}</span></span>
            </div>
            <div className="crud-act">
              <button className="toggle-mini" role="switch" aria-checked={p.enabled} onClick={() => run(() => api.projects.save({ ...p, enabled: !p.enabled }), p.enabled ? 'Скрыт с карты' : 'Показан на карте')} aria-label={p.enabled ? 'Скрыть' : 'Показать'}><span className="sw" /></button>
              <button className="icon-btn" onClick={() => setEdit(p)} aria-label="Изменить"><Icon name="edit" size={16} /></button>
              <button className="icon-btn" onClick={() => { if (window.confirm(`Удалить «${p.title}»?`)) run(() => api.projects.remove(p.id), 'Объект удалён'); }} aria-label="Удалить"><Icon name="trash" size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Объект' : 'Новый объект'} wide>
        {edit && <ProjectForm initial={edit} onDone={() => setEdit(null)} />}
      </Modal>
    </div>
  );
}

function ProjectForm({ initial, onDone }: { initial: Project; onDone: () => void }) {
  const [p, setP] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const upd = (patch: Partial<Project>) => setP({ ...p, ...patch });

  const suggest = async () => {
    const e = await api.estimates.calculate(p);
    upd({ price: Math.round(e.total / 10000) * 10000, weeks: e.weeks.min });
  };
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setBusy(true); setErr(null);
    try { await api.projects.save(p); toast('Объект сохранён', 'ok'); onDone(); } catch (e) { setErr(humanError(e)); } finally { setBusy(false); }
  };
  const placeOnMap = (e: React.MouseEvent) => {
    const svg = mapRef.current?.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    upd({ x: Math.round(((e.clientX - r.left) / r.width) * 1000), y: Math.round(60 + ((e.clientY - r.top) / r.height) * 740) });
  };
  const toggleOpt = (o: OptionId) => upd({ options: p.options.includes(o) ? p.options.filter((x) => x !== o) : [...p.options, o] });

  return (
    <form className="pform" onSubmit={save}>
      <label className="field"><span>Название</span><input className="input" value={p.title} onChange={(e) => upd({ title: e.target.value })} data-autofocus /></label>
      <div className="nf-row">
        <label className="field"><span>Район</span>
          <select className="input" value={p.district} onChange={(e) => upd({ district: e.target.value as Project['district'] })}>
            {catalog.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Где (примерно)</span><input className="input" value={p.street} onChange={(e) => upd({ street: e.target.value })} /></label>
      </div>
      <div className="field"><span className="small muted">Точка на карте — нажмите на схему</span>
        <div className="pform-map" ref={mapRef} onClick={placeOnMap}>
          <MapNN projects={[p]} district={p.district} activeId={p.id} onPick={() => undefined} onDistrict={() => undefined} counts={{}} />
        </div>
      </div>
      <div className="nf-row">
        <label className="field"><span>Дом</span>
          <select className="input" value={p.house} onChange={(e) => upd({ house: e.target.value as Project['house'] })}>
            {catalog.houseTypes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        <NumField label="Комнат" value={p.rooms} onChange={(n) => upd({ rooms: n })} min={1} max={4} />
        <NumField label="Санузлов" value={p.bathrooms} onChange={(n) => upd({ bathrooms: n })} min={1} max={3} />
        <NumField label="Площадь" value={p.area} onChange={(n) => upd({ area: n })} suffix="м²" />
      </div>
      <Segmented label="Тип ремонта" value={p.type} options={catalog.renovationTypes.map((t) => ({ value: t.id, label: t.short }))} onChange={(v) => upd({ type: v })} />
      <Segmented label="Уровень" value={p.level} options={catalog.budgetLevels.map((l) => ({ value: l.id, label: l.name }))} onChange={(v) => upd({ level: v })} />
      <div className="chips">{catalog.options.map((o) => <button type="button" key={o.id} className="chip" aria-pressed={p.options.includes(o.id)} onClick={() => toggleOpt(o.id)}>{o.name}</button>)}</div>
      <div className="nf-row">
        <NumField label="Итог по договору" value={p.price} onChange={(n) => upd({ price: n })} suffix="₽" />
        <NumField label="Срок" value={p.weeks} onChange={(n) => upd({ weeks: n })} suffix="нед" />
        <NumField label="Год" value={p.year} onChange={(n) => upd({ year: n })} min={2000} max={2100} />
      </div>
      <button type="button" className="link small" onClick={suggest}>Подставить цену и срок по текущему калькулятору</button>
      <label className="field"><span>Описание</span><textarea className="input" value={p.note} onChange={(e) => upd({ note: e.target.value })} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={18} />} Сохранить объект</button>
    </form>
  );
}
