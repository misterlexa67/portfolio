import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, COVER_LIBRARY, toFriendly, type Category, type Restaurant, type RestaurantInput, type Zone } from '../api';
import { useQuery } from '../lib/useQuery';
import { Button, EmptyState, ErrorState, Img, Segmented, Skeleton, Toggle } from '../components/ui';
import { Sheet, Confirm } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { CityMap } from '../components/CityMap';
import { RestaurantCover } from '../components/RestaurantCard';
import { useToast } from '../components/Toast';
import { AdminPage, F, ImagePicker, NumInput, Pill, RowActions } from './kit';
import { rub } from '../lib/format';

const TINTS = ['#F2E9DF', '#F3EBE4', '#EDF0E7', '#EEEAF0', '#E9EEF1', '#F4EDE9'];

const blank = (): RestaurantInput => ({
  name: '', tagline: '', categoryIds: [], cookMinutes: 20, baseDeliveryFee: 0, minOrder: 500,
  hours: { open: '10:00', close: '22:00' }, address: '', location: { x: 600, y: 330 },
  cover: { kind: 'still', tint: TINTS[0], images: [] }, sections: [{ id: '', name: 'Основное' }], enabled: true,
});

function RestaurantForm({ initial, open, onClose }: { initial: Restaurant | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<RestaurantInput>(blank());
  const [cats, setCats] = useState<Category[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      const { id: _i, sort: _s, rating: _r, ratingCount: _c, ...rest } = initial;
      setF(JSON.parse(JSON.stringify(rest)));
    } else setF(blank());
    api.admin.categories().then(setCats, () => {});
    api.catalog.zones().then(setZones, () => {});
  }, [open, initial]);

  const set = <K extends keyof RestaurantInput>(k: K, v: RestaurantInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.admin.restaurants.save(f, initial?.id);
      toast({ text: initial ? 'Ресторан сохранён — изменения уже в приложении' : 'Ресторан добавлен', tone: 'success' });
      onClose();
    } catch (e) { setError(toFriendly(e).message); } finally { setBusy(false); }
  };

  const still = f.cover.kind === 'still' ? f.cover : null;

  return (
    <Sheet open={open} onClose={onClose} title={initial ? `«${initial.name}»` : 'Новый ресторан'} size="tall"
      footer={<div className="filters-footer"><Button variant="quiet" size="lg" onClick={onClose}>Отмена</Button><Button size="lg" block loading={busy} onClick={save}>Сохранить</Button></div>}>
      <div className="a-form">
        {error && <p className="a-form__error" role="alert"><Icon name="info" size={16} /> {error}</p>}
        <F label="Название" wide><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Например, Пельменная на Рождественской" /></F>
        <F label="Короткое описание" wide><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Что здесь готовят лучше всего" /></F>
        <div className="a-field a-field--wide">
          <span className="field__label">Кухня</span>
          <div className="choice-row">
            {cats.map((c) => {
              const on = f.categoryIds.includes(c.id);
              return <button key={c.id} type="button" className={`choice${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set('categoryIds', on ? f.categoryIds.filter((x) => x !== c.id) : [...f.categoryIds, c.id])}>{c.name}</button>;
            })}
          </div>
        </div>
        <F label="Открытие"><input className="input" type="time" value={f.hours.open} onChange={(e) => set('hours', { ...f.hours, open: e.target.value })} /></F>
        <F label="Закрытие" hint="Можно после полуночи, например 02:00"><input className="input" type="time" value={f.hours.close === '24:00' ? '00:00' : f.hours.close} onChange={(e) => set('hours', { ...f.hours, close: e.target.value === '00:00' ? '24:00' : e.target.value })} /></F>
        <F label="Минимальный заказ"><NumInput value={f.minOrder} onChange={(v) => set('minOrder', Number(v))} suffix="₽" /></F>
        <F label="Базовая доставка" hint="К ней прибавляется надбавка зоны"><NumInput value={f.baseDeliveryFee} onChange={(v) => set('baseDeliveryFee', Number(v))} suffix="₽" /></F>
        <F label="Время приготовления"><NumInput value={f.cookMinutes} onChange={(v) => set('cookMinutes', Number(v))} suffix="мин" /></F>
        <F label="Адрес ресторана"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Улица, дом" /></F>
        <div className="a-field a-field--wide">
          <span className="field__label">Точка на карте — отсюда стартует курьер</span>
          <div className="a-map"><CityMap label="Расположение ресторана" zones={zones} onPick={(p) => set('location', p)} pins={[{ id: 'r', kind: 'restaurant', point: f.location }]} /></div>
        </div>

        <div className="a-field a-field--wide">
          <span className="field__label">Обложка</span>
          <Segmented label="Тип обложки" value={f.cover.kind} onChange={(k) => set('cover', k === 'photo' ? { kind: 'photo', src: COVER_LIBRARY[0] } : { kind: 'still', tint: TINTS[0], images: [] })} options={[{ value: 'still', label: 'Композиция из блюд' }, { value: 'photo', label: 'Фото' }]} />
        </div>
        <div className="a-cover-preview a-field--wide"><RestaurantCover cover={f.cover} alt="" /></div>
        {f.cover.kind === 'photo' && (
          <div className="a-field a-field--wide">
            <div className="a-cover-lib">
              {COVER_LIBRARY.map((src) => <button key={src} type="button" className={`a-cover-lib__item${f.cover.kind === 'photo' && f.cover.src === src ? ' is-on' : ''}`} onClick={() => set('cover', { kind: 'photo', src })}><Img src={src} alt="" /></button>)}
            </div>
          </div>
        )}
        {still && (
          <>
            <div className="a-field a-field--wide">
              <span className="field__label">Фон</span>
              <div className="a-swatches">{TINTS.map((t) => <button key={t} type="button" className={`a-swatch${still.tint === t ? ' is-on' : ''}`} style={{ background: t }} onClick={() => set('cover', { ...still, tint: t })} aria-label={`Фон ${t}`} />)}</div>
            </div>
            {[0, 1, 2].map((i) => (
              <ImagePicker key={i} label={i === 0 ? 'Главное блюдо' : `Блюдо ${i + 1}`} value={still.images[i] ?? ''} onChange={(src) => { const images = still.images.slice(); images[i] = src; set('cover', { ...still, images: images.filter(Boolean) }); }} />
            ))}
          </>
        )}

        <div className="a-field a-field--wide">
          <span className="field__label">Разделы меню</span>
          <ul className="a-sections">
            {f.sections.map((s, i) => (
              <li key={s.id || `new-${i}`}>
                <input className="input" value={s.name} onChange={(e) => set('sections', f.sections.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} aria-label={`Раздел ${i + 1}`} />
                <RowActions first={i === 0} last={i === f.sections.length - 1}
                  onUp={() => { const a = f.sections.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; set('sections', a); }}
                  onDown={() => { const a = f.sections.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; set('sections', a); }}>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label="Удалить раздел" onClick={() => set('sections', f.sections.filter((_, k) => k !== i))}><Icon name="trash" size={16} /></button>
                </RowActions>
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" size="sm" icon="plus" onClick={() => set('sections', [...f.sections, { id: '', name: '' }])}>Раздел</Button>
        </div>
        <label className="filter-toggle a-field--wide"><span><b>Показывать гостям</b><span className="muted t-sm">Выключенный ресторан скрыт из приложения</span></span><Toggle checked={f.enabled} onChange={(v) => set('enabled', v)} label="Показывать гостям" /></label>
      </div>
    </Sheet>
  );
}

export function RestaurantsAdmin() {
  const toast = useToast();
  const q = useQuery(() => api.admin.restaurants.list(), [], ['catalog']);
  const [edit, setEdit] = useState<{ open: boolean; r: Restaurant | null }>({ open: false, r: null });
  const [remove, setRemove] = useState<Restaurant | null>(null);
  const list = q.data ?? [];
  const run = (p: Promise<unknown>, msg?: string) => p.then(() => msg && toast({ text: msg, tone: 'success' }), (e) => toast({ text: toFriendly(e).message, tone: 'danger' }));

  return (
    <AdminPage title="Рестораны" sub="Порядок здесь — порядок в приложении." actions={<Button icon="plus" onClick={() => setEdit({ open: true, r: null })}>Добавить ресторан</Button>}>
      {q.error && <ErrorState message={q.error.message} onRetry={q.reload} />}
      {q.loading && <Skeleton h={300} r={20} />}
      {q.data && !list.length && <EmptyState art="receipt" title="Ресторанов нет" text="Добавьте первый ресторан — он сразу появится в приложении." />}
      <ul className="a-rlist">
        {list.map((r, i) => (
          <li key={r.id} className={`a-rrow a-card${r.enabled ? '' : ' is-off'}`}>
            <div className="a-rrow__cover"><RestaurantCover cover={r.cover} alt="" /></div>
            <div className="a-rrow__info">
              <div className="a-rrow__title"><b>{r.name}</b>{r.enabled ? <Pill tone="success">В приложении</Pill> : <Pill>Скрыт</Pill>}</div>
              <span className="muted t-sm">{r.hours.open}–{r.hours.close === '24:00' ? '00:00' : r.hours.close} · мин. заказ {rub(r.minOrder)} · доставка от {rub(r.baseDeliveryFee)}</span>
              <span className="muted t-sm">{r.dishCount} блюд{r.unavailableCount ? ` · ${r.unavailableCount} нет в наличии` : ''}</span>
            </div>
            <div className="a-rrow__actions">
              <Toggle checked={r.enabled} label={`Показывать «${r.name}»`} onChange={(v) => run(api.admin.restaurants.setEnabled(r.id, v), v ? 'Ресторан снова виден гостям' : 'Ресторан скрыт из приложения')} />
              <RowActions first={i === 0} last={i === list.length - 1} onUp={() => run(api.admin.restaurants.move(r.id, -1))} onDown={() => run(api.admin.restaurants.move(r.id, 1))} />
              <a className="btn btn--secondary btn--sm" href={`#/r/${r.id}?preview=1`} target="_blank" rel="noreferrer"><span className="btn__content"><Icon name="eye" size={16} />Предпросмотр</span></a>
              <Link className="btn btn--secondary btn--sm" to={`/admin/menu?r=${r.id}`}><span className="btn__content"><Icon name="cutlery" size={16} />Меню</span></Link>
              <Button size="sm" variant="secondary" icon="edit" onClick={() => setEdit({ open: true, r })}>Изменить</Button>
              <button className="icon-btn icon-btn--sm" aria-label={`Удалить «${r.name}»`} onClick={() => setRemove(r)}><Icon name="trash" size={17} /></button>
            </div>
          </li>
        ))}
      </ul>
      <RestaurantForm open={edit.open} initial={edit.r} onClose={() => setEdit({ open: false, r: null })} />
      <Confirm open={!!remove} title={`Удалить «${remove?.name}»?`} text="Ресторан и всё его меню будут удалены. Если нужно временно скрыть — лучше выключите его." confirmLabel="Удалить навсегда" danger
        onConfirm={() => { const r = remove!; setRemove(null); run(api.admin.restaurants.remove(r.id), 'Ресторан удалён'); }} onClose={() => setRemove(null)} />
    </AdminPage>
  );
}
