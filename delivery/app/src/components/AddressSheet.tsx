import { useEffect, useMemo, useState } from 'react';
import { api, STREETS, toFriendly, type Address, type Point, type Zone } from '../api';
import { Sheet } from './Sheet';
import { Button, Note, Segmented } from './ui';
import { Icon } from './Icon';
import { CityMap } from './CityMap';
import { useStore } from './AppStore';
import { useToast } from './Toast';
import { rub } from '../lib/format';

type Check = Awaited<ReturnType<typeof api.profile.checkPoint>>;

const emptyDetails = { entrance: '', floor: '', apartment: '', comment: '' };

export function AddressSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<Address | null>(null);

  useEffect(() => {
    if (open) { setMode(profile?.addresses.length ? 'list' : 'edit'); setEditing(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = async (a: Address) => {
    try {
      await api.profile.selectAddress(a.id);
      toast({ text: `Доставим: ${a.street}`, icon: 'pin' });
      onClose();
    } catch (e) { toast({ text: toFriendly(e).message, tone: 'danger' }); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'list' ? 'Куда доставить?' : editing ? 'Изменить адрес' : 'Новый адрес'} size={mode === 'edit' ? 'tall' : 'auto'}>
      {mode === 'list' && profile && (
        <div className="addr-list">
          {profile.addresses.map((a) => {
            const on = a.id === profile.selectedAddressId;
            return (
              <div key={a.id} className={`addr-row${on ? ' is-on' : ''}`}>
                <button className="addr-row__main" onClick={() => select(a)} aria-pressed={on}>
                  <span className="addr-row__icon"><Icon name={a.label === 'Работа' ? 'store' : a.label === 'Дом' ? 'home' : 'pin'} size={20} /></span>
                  <span className="addr-row__text">
                    <span className="addr-row__street">{a.street}</span>
                    <span className="addr-row__sub">{[a.label, a.district, a.details.apartment && `кв. ${a.details.apartment}`].filter(Boolean).join(' · ')}</span>
                  </span>
                  {on && <Icon name="check" size={20} className="addr-row__check" />}
                </button>
                <button className="icon-btn" aria-label={`Изменить адрес ${a.street}`} onClick={() => { setEditing(a); setMode('edit'); }}><Icon name="edit" size={18} /></button>
              </div>
            );
          })}
          <Button variant="secondary" icon="plus" block size="lg" onClick={() => { setEditing(null); setMode('edit'); }}>Добавить адрес</Button>
        </div>
      )}
      {mode === 'edit' && (
        <AddressEditor
          initial={editing}
          onCancel={profile?.addresses.length ? () => setMode('list') : undefined}
          onSaved={() => onClose()}
        />
      )}
    </Sheet>
  );
}

function AddressEditor({ initial, onSaved, onCancel }: { initial: Address | null; onSaved: () => void; onCancel?: () => void }) {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [point, setPoint] = useState<Point | null>(initial?.point ?? null);
  const [street, setStreet] = useState(initial?.street ?? '');
  const [label, setLabel] = useState(initial?.label === 'Дом' || initial?.label === 'Работа' ? initial.label : initial ? 'other' : 'Дом');
  const [details, setDetails] = useState(initial?.details ?? emptyDetails);
  const [check, setCheck] = useState<Check | null>(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => { zonesForMap().then(setZones); }, []);
  useEffect(() => {
    if (!point) { setCheck(null); return; }
    api.profile.checkPoint(point).then(setCheck, () => {});
  }, [point]);

  const suggestions = useMemo(() => {
    const q = street.toLowerCase().replace(/ё/g, 'е').trim();
    if (!focused) return [];
    return STREETS.filter((s) => !q || s.street.toLowerCase().replace(/ё/g, 'е').includes(q)).slice(0, 5);
  }, [street, focused]);

  const pick = (p: Point) => {
    setPoint(p);
    if (!street || street.startsWith('Точка на карте')) setStreet('Точка на карте');
  };

  const save = async () => {
    if (!point) { toast({ text: 'Отметьте точку на карте или выберите улицу из подсказок', icon: 'pin' }); return; }
    setSaving(true);
    try {
      const st = street.trim() === 'Точка на карте' && check ? `Точка на карте, ${check.district}` : street;
      const a = await api.profile.saveAddress({ label: label === 'other' ? '' : label, street: st, details, point }, initial?.id);
      toast({ text: `Доставим: ${a.street}`, tone: 'success', icon: 'pin' });
      onSaved();
    } catch (e) {
      toast({ text: toFriendly(e).message, tone: 'danger' });
    } finally { setSaving(false); }
  };

  return (
    <div className="addr-edit">
      <div className="addr-map">
        <CityMap
          label="Карта Нижнего Новгорода с зонами доставки. Нажмите, чтобы отметить точку."
          zones={zones}
          highlightZoneId={check?.zone?.id}
          onPick={pick}
          pins={point ? [{ id: 'p', kind: 'pick', point }] : []}
          compactLabels={false}
        />
        {!point && <div className="addr-map__hint"><Icon name="pin" size={16} /> Нажмите на карту, чтобы отметить дом</div>}
      </div>

      {check && (
        check.zone
          ? <Note tone="success" icon="check"><b>{check.zone.name}</b> · {check.district}. {check.zone.surcharge ? `Доставка +${rub(check.zone.surcharge)}, ` : 'Без надбавки к доставке, '}{check.zone.extraMinutes ? `+${check.zone.extraMinutes} мин к времени` : 'быстрее всего'}</Note>
          : <Note tone="warn" icon="map"><b>Сюда пока не доставляем.</b> {check.district}. Выберите точку в одной из закрашенных зон.</Note>
      )}

      <div className="field">
        <label className="field__label" htmlFor="addr-street">Улица и дом</label>
        <div className="combo">
          <input
            id="addr-street"
            className="input"
            value={street}
            placeholder="Например, Большая Покровская, 12"
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onChange={(e) => setStreet(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="combo__list" role="listbox">
              {suggestions.map((s) => (
                <li key={s.street}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => { setStreet(s.street); setPoint(s.point); setFocused(false); }}>
                    <Icon name="pin" size={16} /> {s.street}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="field-row">
        <div className="field"><label className="field__label" htmlFor="addr-ent">Подъезд</label><input id="addr-ent" className="input" inputMode="numeric" value={details.entrance} onChange={(e) => setDetails({ ...details, entrance: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="addr-floor">Этаж</label><input id="addr-floor" className="input" inputMode="numeric" value={details.floor} onChange={(e) => setDetails({ ...details, floor: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="addr-apt">Квартира</label><input id="addr-apt" className="input" inputMode="numeric" value={details.apartment} onChange={(e) => setDetails({ ...details, apartment: e.target.value })} /></div>
      </div>

      <div className="field">
        <span className="field__label">Как назвать</span>
        <Segmented label="Название адреса" value={label} onChange={setLabel} options={[{ value: 'Дом', label: 'Дом' }, { value: 'Работа', label: 'Работа' }, { value: 'other', label: 'Другое' }]} />
      </div>

      <div className="addr-edit__actions">
        {onCancel && <Button variant="quiet" size="lg" onClick={onCancel}>Назад</Button>}
        <Button size="lg" block loading={saving} onClick={save}>Сохранить адрес</Button>
      </div>
    </div>
  );
}

/** Зоны для отрисовки берём из сервиса (то, что настроил владелец). */
async function zonesForMap(): Promise<Zone[]> {
  return api.catalog.zones();
}
