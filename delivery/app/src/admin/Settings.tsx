import { useEffect, useState } from 'react';
import { api, toFriendly, type Settings } from '../api';
import { Button, Segmented, Skeleton, Toggle } from '../components/ui';
import { Confirm } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AdminPage, F, NumInput } from './kit';

export function SettingsAdmin() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  useEffect(() => { api.admin.settings.get().then(setS, (e) => setError(toFriendly(e).message)); }, []);

  const save = async () => {
    if (!s) return;
    setBusy(true); setError(null);
    try { const { adminPin: _p, ...rest } = s; setS(await api.admin.settings.save(rest)); toast({ text: 'Настройки сохранены', tone: 'success' }); }
    catch (e) { setError(toFriendly(e).message); } finally { setBusy(false); }
  };

  return (
    <AdminPage title="Настройки">
      {!s ? <Skeleton h={300} r={20} /> : (
        <section className="a-card a-form a-settings">
          {error && <p className="a-form__error" role="alert"><Icon name="info" size={16} /> {error}</p>}
          <F label="Сервисный сбор" hint="Добавляется к каждому заказу"><NumInput value={s.serviceFee} onChange={(v) => setS({ ...s, serviceFee: Number(v) })} suffix="₽" /></F>
          <F label="Стартовый демо-баланс" hint="Получает новый гость и после «Сбросить демо-данные»"><NumInput value={s.startingBalance} onChange={(v) => setS({ ...s, startingBalance: Number(v) })} suffix="₽" /></F>
          <div className="a-field a-field--wide">
            <span className="field__label">Скорость демо-симуляции заказа</span>
            <Segmented label="Скорость симуляции" value={String(s.demoSpeed)} onChange={(v) => setS({ ...s, demoSpeed: Number(v) })} options={[{ value: '0.5', label: '×0,5' }, { value: '1', label: '×1' }, { value: '2', label: '×2' }, { value: '4', label: '×4' }]} />
            <span className="field__hint">При ×1 путь от оплаты до двери занимает около 70 секунд.</span>
          </div>
          <label className="filter-toggle a-field--wide">
            <span><b>Имитировать сбои сети</b><span className="muted t-sm">Каждый пятый запрос будет падать — чтобы проверить экраны ошибок</span></span>
            <Toggle checked={s.simulateErrors} onChange={(v) => setS({ ...s, simulateErrors: v })} label="Имитировать сбои сети" />
          </label>
          <div className="a-field--wide"><Button size="lg" loading={busy} onClick={save}>Сохранить настройки</Button></div>
        </section>
      )}
      <section className="a-card a-danger">
        <div>
          <h2 className="a-card__title">Вернуть исходные данные</h2>
          <p className="muted t-sm">Каталог, зоны, промокоды, настройки и данные гостя станут как в начале демо.</p>
        </div>
        <Button variant="danger" onClick={() => setReset(true)}>Сбросить всё</Button>
      </section>
      <Confirm open={reset} title="Сбросить все демо-данные?" text="Все изменения в меню, ресторанах и зонах будут потеряны." confirmLabel="Сбросить всё" danger
        onConfirm={async () => { setReset(false); await api.admin.resetEverything(); setS(await api.admin.settings.get()); toast({ text: 'Данные возвращены к исходным', tone: 'success' }); }} onClose={() => setReset(false)} />
    </AdminPage>
  );
}
