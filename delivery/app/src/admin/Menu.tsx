import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, toFriendly, type AddonGroup, type Dish, type DishInput, type DishTag } from '../api';
import { useQuery } from '../lib/useQuery';
import { Button, EmptyState, ErrorState, Img, Segmented, Skeleton, Toggle } from '../components/ui';
import { Sheet, Confirm } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AdminPage, F, ImagePicker, NumInput, RowActions } from './kit';
import { rub } from '../lib/format';

const TAGS: { id: DishTag; label: string }[] = [{ id: 'hit', label: 'Хит' }, { id: 'new', label: 'Новинка' }, { id: 'spicy', label: 'Острое' }, { id: 'veg', label: 'Без мяса' }];

function AddonsEditor({ value, onChange }: { value: AddonGroup[]; onChange: (v: AddonGroup[]) => void }) {
  const upd = (i: number, patch: Partial<AddonGroup>) => onChange(value.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  return (
    <div className="a-field a-field--wide">
      <span className="field__label">Добавки</span>
      {value.length === 0 && <p className="muted t-sm">Нет добавок. Например: соус, размер порции, сироп.</p>}
      <div className="a-addons">
        {value.map((g, i) => (
          <div key={g.id || `g${i}`} className="a-addon">
            <div className="a-addon__head">
              <input className="input" value={g.name} placeholder="Название группы, например «Соус»" onChange={(e) => upd(i, { name: e.target.value })} aria-label="Название группы" />
              <button type="button" className="icon-btn icon-btn--sm" aria-label="Удалить группу" onClick={() => onChange(value.filter((_, k) => k !== i))}><Icon name="trash" size={16} /></button>
            </div>
            <div className="a-addon__mode">
              <Segmented label="Тип выбора" value={g.kind} onChange={(kind) => upd(i, { kind, required: kind === 'single' ? g.required : false })} options={[{ value: 'single', label: 'Один вариант' }, { value: 'multi', label: 'Несколько' }]} />
              {g.kind === 'single'
                ? <label className="a-inline"><Toggle checked={g.required} onChange={(required) => upd(i, { required })} label="Обязательно" /> Обязательно</label>
                : <label className="a-inline">Макс. <NumInput value={g.max ?? ''} onChange={(v) => upd(i, { max: v ? Number(v) : undefined })} placeholder="∞" /></label>}
            </div>
            <ul className="a-addon__opts">
              {g.options.map((o, k) => (
                <li key={o.id || `o${k}`}>
                  <input className="input" value={o.name} placeholder="Вариант" onChange={(e) => upd(i, { options: g.options.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} aria-label="Вариант" />
                  <NumInput value={o.price} suffix="₽" onChange={(v) => upd(i, { options: g.options.map((x, j) => (j === k ? { ...x, price: Number(v) } : x)) })} aria-label="Доплата" />
                  <button type="button" className="icon-btn icon-btn--sm" aria-label="Удалить вариант" onClick={() => upd(i, { options: g.options.filter((_, j) => j !== k) })}><Icon name="close" size={16} /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="link t-sm" onClick={() => upd(i, { options: [...g.options, { id: '', name: '', price: 0 }] })}>+ вариант</button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" icon="plus" onClick={() => onChange([...value, { id: '', name: '', kind: 'multi', required: false, options: [{ id: '', name: '', price: 0 }] }])}>Группа добавок</Button>
    </div>
  );
}

function DishForm({ open, initial, restaurantId, sections, onClose }: { open: boolean; initial: Dish | null; restaurantId: string; sections: { id: string; name: string }[]; onClose: () => void }) {
  const toast = useToast();
  const blank = (): DishInput => ({ restaurantId, sectionId: sections[0]?.id ?? '', name: '', description: '', composition: '', price: 0, oldPrice: null, weight: 0, unit: 'г', calories: 0, image: '', available: true, tags: [], addonGroups: [] });
  const [f, setF] = useState<DishInput>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) { const { id: _i, sort: _s, ...rest } = initial; setF(JSON.parse(JSON.stringify(rest))); } else setF(blank());
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof DishInput>(k: K, v: DishInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null);
    try { await api.admin.dishes.save(f, initial?.id); toast({ text: initial ? 'Блюдо сохранено' : 'Блюдо добавлено в меню', tone: 'success' }); onClose(); }
    catch (e) { setError(toFriendly(e).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={initial ? initial.name : 'Новое блюдо'} size="tall"
      footer={<div className="filters-footer"><Button variant="quiet" size="lg" onClick={onClose}>Отмена</Button><Button size="lg" block loading={busy} onClick={save}>Сохранить</Button></div>}>
      <div className="a-form">
        {error && <p className="a-form__error" role="alert"><Icon name="info" size={16} /> {error}</p>}
        <ImagePicker value={f.image} onChange={(v) => set('image', v)} />
        <F label="Раздел меню">
          <select className="input" value={f.sectionId} onChange={(e) => set('sectionId', e.target.value)}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </F>
        <F label="Название" wide><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></F>
        <F label="Описание" wide><textarea className="input input--area" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></F>
        <F label="Состав" wide><textarea className="input input--area" rows={2} value={f.composition} onChange={(e) => set('composition', e.target.value)} /></F>
        <F label="Цена"><NumInput value={f.price || ''} onChange={(v) => set('price', Number(v))} suffix="₽" /></F>
        <F label="Старая цена" hint="Для скидки; пусто — без скидки"><NumInput value={f.oldPrice ?? ''} onChange={(v) => set('oldPrice', v ? Number(v) : null)} suffix="₽" /></F>
        <F label="Вес / объём">
          <span className="a-weight">
            <NumInput value={f.weight || ''} onChange={(v) => set('weight', Number(v))} />
            <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value as DishInput['unit'])} aria-label="Единица"><option value="г">г</option><option value="мл">мл</option><option value="шт">шт</option></select>
          </span>
        </F>
        <F label="Калорийность"><NumInput value={f.calories || ''} onChange={(v) => set('calories', Number(v))} suffix="ккал" /></F>
        <div className="a-field a-field--wide">
          <span className="field__label">Метки</span>
          <div className="choice-row">{TAGS.map((t) => { const on = f.tags.includes(t.id); return <button key={t.id} type="button" className={`choice${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set('tags', on ? f.tags.filter((x) => x !== t.id) : [...f.tags, t.id])}>{t.label}</button>; })}</div>
        </div>
        <AddonsEditor value={f.addonGroups} onChange={(v) => set('addonGroups', v)} />
        <label className="filter-toggle a-field--wide"><span><b>В наличии</b><span className="muted t-sm">Выключите — гости увидят «Нет в наличии»</span></span><Toggle checked={f.available} onChange={(v) => set('available', v)} label="В наличии" /></label>
      </div>
    </Sheet>
  );
}

export function MenuAdmin() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rests = useQuery(() => api.admin.restaurants.list(), [], ['catalog']);
  const rid = params.get('r') ?? rests.data?.[0]?.id ?? '';
  const dishes = useQuery(() => (rid ? api.admin.dishes.list(rid) : Promise.resolve([])), [rid], ['catalog']);
  const [edit, setEdit] = useState<{ open: boolean; d: Dish | null }>({ open: false, d: null });
  const [remove, setRemove] = useState<Dish | null>(null);
  const rest = rests.data?.find((r) => r.id === rid);
  const list = dishes.data ?? [];
  const run = (p: Promise<unknown>, msg?: string) => p.then(() => msg && toast({ text: msg, tone: 'success' }), (e) => toast({ text: toFriendly(e).message, tone: 'danger' }));
  const grouped = useMemo(() => (rest ? rest.sections.map((s) => ({ ...s, items: list.filter((d) => d.sectionId === s.id) })) : []), [rest, list]);

  return (
    <AdminPage title="Меню" sub="Цены, наличие и добавки. Изменения сразу видны гостям."
      actions={rest && <><a className="btn btn--secondary btn--md" href={`#/r/${rest.id}?preview=1`} target="_blank" rel="noreferrer"><span className="btn__content"><Icon name="eye" size={18} />Предпросмотр</span></a><Button icon="plus" onClick={() => setEdit({ open: true, d: null })}>Добавить блюдо</Button></>}>
      <div className="tabs no-scrollbar a-filters">
        {rests.loading && <Skeleton w={300} h={40} r={20} />}
        {rests.data?.map((r) => <button key={r.id} className={`tab${r.id === rid ? ' is-on' : ''}`} onClick={() => setParams({ r: r.id })}>{r.name}</button>)}
      </div>
      {dishes.error && <ErrorState message={dishes.error.message} onRetry={dishes.reload} />}
      {dishes.loading && <Skeleton h={300} r={20} />}
      {rest && !dishes.loading && !list.length && <EmptyState art="receipt" title="В меню пока пусто" text="Добавьте первое блюдо — выберите фото из библиотеки." />}
      {grouped.filter((g) => g.items.length).map((g) => (
        <section key={g.id} className="a-card a-menu-sec">
          <h2 className="a-card__title">{g.name}</h2>
          <ul className="a-dlist">
            {g.items.map((d) => {
              const idx = list.indexOf(d);
              return (
                <li key={d.id} className={`a-drow${d.available ? '' : ' is-off'}`}>
                  <span className="a-drow__img"><Img src={d.image} alt="" /></span>
                  <span className="a-drow__info">
                    <b>{d.name}</b>
                    <span className="muted t-sm num">{rub(d.price)}{d.oldPrice ? <s> {rub(d.oldPrice)}</s> : ''} · {d.weight} {d.unit} · {d.calories} ккал{d.addonGroups.length ? ` · добавок: ${d.addonGroups.length}` : ''}</span>
                  </span>
                  <span className="a-drow__stock">
                    <span className={`a-stock${d.available ? '' : ' is-off'}`}>{d.available ? 'В наличии' : 'Нет в наличии'}</span>
                    <Toggle checked={d.available} label={`«${d.name}» в наличии`} onChange={(v) => run(api.admin.dishes.setAvailable(d.id, v), v ? `«${d.name}» снова в наличии` : `«${d.name}»: нет в наличии`)} />
                  </span>
                  <span className="a-drow__actions">
                    <RowActions first={idx === 0} last={idx === list.length - 1} onUp={() => run(api.admin.dishes.move(d.id, -1))} onDown={() => run(api.admin.dishes.move(d.id, 1))} />
                    <button className="icon-btn icon-btn--sm" aria-label={`Изменить «${d.name}»`} onClick={() => setEdit({ open: true, d })}><Icon name="edit" size={17} /></button>
                    <button className="icon-btn icon-btn--sm" aria-label={`Удалить «${d.name}»`} onClick={() => setRemove(d)}><Icon name="trash" size={17} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {rest && <DishForm open={edit.open} initial={edit.d} restaurantId={rest.id} sections={rest.sections} onClose={() => setEdit({ open: false, d: null })} />}
      <Confirm open={!!remove} title={`Удалить «${remove?.name}»?`} text="Блюдо исчезнет из меню и корзин гостей. Если оно просто закончилось — выключите «В наличии»." confirmLabel="Удалить" danger
        onConfirm={() => { const d = remove!; setRemove(null); run(api.admin.dishes.remove(d.id), 'Блюдо удалено'); }} onClose={() => setRemove(null)} />
    </AdminPage>
  );
}
