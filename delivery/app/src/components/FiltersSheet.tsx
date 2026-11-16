import { useEffect, useState } from 'react';
import { api, type RestaurantFilters, type SortKey } from '../api';
import { Sheet } from './Sheet';
import { Button, Toggle } from './ui';
import { plural } from '../lib/format';

export type Filters = Pick<RestaurantFilters, 'minRating' | 'maxMinutes' | 'maxFee' | 'freeDelivery' | 'sort'>;
export const EMPTY_FILTERS: Filters = { minRating: null, maxMinutes: null, maxFee: null, freeDelivery: false, sort: 'recommended' };

export const activeFilterCount = (f: Filters) =>
  [f.minRating, f.maxMinutes, f.maxFee !== null && f.maxFee !== undefined ? 1 : null, f.freeDelivery || null, f.sort !== 'recommended' ? 1 : null].filter(Boolean).length;

function Choice<T extends string | number | null>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="filter-group">
      <legend className="filter-group__title">{label}</legend>
      <div className="choice-row">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className={`choice${value === o.value ? ' is-on' : ''}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function FiltersSheet({ open, value, base, onApply, onClose }: { open: boolean; value: Filters; base: RestaurantFilters; onApply: (f: Filters) => void; onClose: () => void }) {
  const [f, setF] = useState<Filters>(value);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { if (open) setF(value); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.catalog.restaurants({ ...base, ...f }).then((l) => { if (alive) setCount(l.length); }, () => {});
    return () => { alive = false; };
  }, [f, open, base]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Фильтры и сортировка"
      footer={
        <div className="filters-footer">
          <Button variant="quiet" size="lg" onClick={() => setF(EMPTY_FILTERS)}>Сбросить</Button>
          <Button size="lg" block onClick={() => { onApply(f); onClose(); }} disabled={count === 0}>
            {count === null ? 'Показать' : count === 0 ? 'Ничего не нашли' : `Показать ${count} ${plural(count, 'ресторан', 'ресторана', 'ресторанов')}`}
          </Button>
        </div>
      }
    >
      <Choice<SortKey> label="Сортировка" value={f.sort ?? 'recommended'} onChange={(sort) => setF({ ...f, sort })} options={[
        { value: 'recommended', label: 'Рекомендуем' }, { value: 'rating', label: 'По рейтингу' }, { value: 'time', label: 'Быстрее' }, { value: 'fee', label: 'Дешевле доставка' },
      ]} />
      <Choice<number | null> label="Рейтинг" value={f.minRating ?? null} onChange={(minRating) => setF({ ...f, minRating })} options={[
        { value: null, label: 'Любой' }, { value: 4.7, label: '4,7 и выше' }, { value: 4.8, label: '4,8 и выше' },
      ]} />
      <Choice<number | null> label="Время доставки" value={f.maxMinutes ?? null} onChange={(maxMinutes) => setF({ ...f, maxMinutes })} options={[
        { value: null, label: 'Любое' }, { value: 35, label: 'до 35 мин' }, { value: 50, label: 'до 50 мин' },
      ]} />
      <Choice<number | null> label="Стоимость доставки" value={f.maxFee ?? null} onChange={(maxFee) => setF({ ...f, maxFee })} options={[
        { value: null, label: 'Любая' }, { value: 100, label: 'до 100 ₽' }, { value: 200, label: 'до 200 ₽' },
      ]} />
      <label className="filter-toggle">
        <span><b>Бесплатная доставка</b><span className="muted t-sm">До вашего адреса</span></span>
        <Toggle checked={!!f.freeDelivery} onChange={(freeDelivery) => setF({ ...f, freeDelivery })} label="Бесплатная доставка" />
      </label>
    </Sheet>
  );
}
