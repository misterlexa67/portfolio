import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, isApiError, toFriendly, type Slot } from '../api';
import { useQuery } from '../lib/useQuery';
import { useStore } from '../components/AppStore';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/Chrome';
import { CityMap } from '../components/CityMap';
import { Breakdown } from '../components/CartView';
import { Button, Img, Money, Note, Segmented, Skeleton } from '../components/ui';
import { Icon } from '../components/Icon';
import { eta, plural, rub } from '../lib/format';
import { newKey } from '../lib/useMedia';

export function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();
  const { quote, wallet, address, openAddress, openTopUp } = useStore();
  const slots = useQuery(() => api.orders.slots(), [], ['cart', 'profile', 'catalog']);
  const rest = useQuery(() => (quote?.restaurant ? api.catalog.restaurant(quote.restaurant.id) : Promise.resolve(null)), [quote?.restaurant?.id], ['catalog']);
  const [mode, setMode] = useState<'asap' | 'time'>('asap');
  const [slotAt, setSlotAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const key = useRef(newKey());
  const done = useRef(false);

  useEffect(() => {
    if (slots.data && !slots.data.asapAvailable) setMode('time');
  }, [slots.data]);
  useEffect(() => {
    if (mode === 'time' && slots.data?.slots.length && !slots.data.slots.some((s) => s.at === slotAt)) setSlotAt(slots.data.slots[0].at);
  }, [mode, slots.data, slotAt]);

  const focus = useMemo(() => (rest.data && address ? [rest.data.restaurant.location, address.point] : undefined), [rest.data, address]);

  if (quote && !quote.lines.length && !done.current) return <Navigate to="/cart" replace />;

  const total = quote?.totals.total ?? 0;
  const balance = wallet?.balance ?? 0;
  const short = Math.max(0, total - balance);
  const outOfZone = quote?.blockers.some((b) => b.code === 'out_of_zone');
  const noAddress = !address;
  const slot: Slot | null = mode === 'asap' ? { kind: 'asap' } : slotAt ? { kind: 'time', at: slotAt } : null;
  const canPay = !!quote && quote.canCheckout && !outOfZone && !noAddress && !!slot && short === 0 && !submitting && (mode === 'time' || !!slots.data?.asapAvailable);

  const pay = async () => {
    if (!quote || !address || !slot || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.orders.place({ idempotencyKey: key.current, addressId: address.id, slot });
      done.current = true;
      toast({ text: `Заказ №${order.number} оплачен демо-балансом`, tone: 'success' });
      navigate(`/order/${order.id}`, { replace: true });
    } catch (e) {
      const err = toFriendly(e);
      if (isApiError(err) && err.code === 'insufficient_funds') openTopUp(Number(err.details.missing) || undefined);
      if (err.code === 'out_of_zone' || err.code === 'no_address') openAddress();
      if (err.code === 'restaurant_closed') setMode('time');
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="screen checkout">
      <PageHeader title="Оформление заказа" sub={quote?.restaurant?.name} />
      <div className="container checkout__grid">
        <div className="checkout__main">
          {error && <Note tone="danger" icon="info">{error}</Note>}

          <section className="co-sec" aria-labelledby="co-addr">
            <h2 className="co-sec__title" id="co-addr">Куда</h2>
            <div className="co-card co-addr">
              <div className="co-addr__map">
                {focus ? (
                  <CityMap
                    label="Маршрут доставки от ресторана до вашего адреса"
                    focus={focus}
                    compactLabels
                    pins={[
                      { id: 'r', kind: 'restaurant', point: focus[0] },
                      { id: 'h', kind: 'home', point: focus[1] },
                    ]}
                  />
                ) : <Skeleton w="100%" h="100%" r={0} />}
              </div>
              <button className="co-addr__row" onClick={openAddress}>
                <Icon name="pin" size={20} />
                <span className="co-addr__text">
                  <b>{address?.street ?? 'Выберите адрес'}</b>
                  <span>{address ? [address.details.entrance && `подъезд ${address.details.entrance}`, address.details.floor && `этаж ${address.details.floor}`, address.details.apartment && `кв. ${address.details.apartment}`].filter(Boolean).join(', ') || address.district : 'Нажмите, чтобы указать'}</span>
                </span>
                <span className="link">Изменить</span>
              </button>
              {quote?.zone && <p className="co-addr__zone"><span className="zone-dot" /> {quote.zone.name} · доставка {quote.totals.delivery ? rub(quote.totals.delivery) : 'бесплатно'}</p>}
            </div>
            {outOfZone && <Note tone="warn" icon="map" action={<Button size="sm" variant="secondary" onClick={openAddress}>Другой адрес</Button>}><b>Сюда пока не доставляем.</b> Выберите адрес внутри зон на карте — в Нагорной или Заречной части.</Note>}
          </section>

          <section className="co-sec" aria-labelledby="co-time">
            <h2 className="co-sec__title" id="co-time">Когда</h2>
            <Segmented
              label="Время доставки"
              value={mode}
              onChange={(v) => { if (v === 'asap' && !slots.data?.asapAvailable) { toast({ text: `Ресторан откроется в ${slots.data?.opensAt} — выберите время`, icon: 'clock' }); return; } setMode(v); }}
              options={[
                { value: 'asap', label: <span className="seg-2"><b>Как можно скорее</b><span className="num">{slots.data?.asapAvailable ? eta(quote?.eta ?? null) : 'закрыто'}</span></span> },
                { value: 'time', label: <span className="seg-2"><b>Ко времени</b><span>сегодня</span></span> },
              ]}
            />
            {mode === 'time' && (
              <div className="slots no-scrollbar" role="radiogroup" aria-label="Время доставки">
                {slots.data?.slots.map((s) => (
                  <button key={s.at} role="radio" aria-checked={slotAt === s.at} className={`slot num${slotAt === s.at ? ' is-on' : ''}`} onClick={() => setSlotAt(s.at)}>{s.label}</button>
                ))}
                {slots.data && !slots.data.slots.length && <p className="muted">Сегодня свободного времени нет — ресторан скоро закрывается.</p>}
              </div>
            )}
          </section>

          <section className="co-sec" aria-labelledby="co-pay">
            <h2 className="co-sec__title" id="co-pay">Оплата</h2>
            <div className="co-card co-pay" role="radiogroup" aria-label="Способ оплаты">
              <div className="co-pay__row" role="radio" aria-checked="true">
                <span className="co-pay__icon"><Icon name="wallet" size={22} /></span>
                <span className="co-pay__text"><b>Демо-баланс</b><span>Доступно <span className="price">{rub(balance)}</span></span></span>
                <span className="co-pay__radio is-on" aria-hidden="true" />
              </div>
            </div>
            {short > 0 && (
              <Note tone="danger" icon="wallet" action={<Button size="sm" onClick={() => openTopUp(short)}>Пополнить демо-баланс</Button>}>
                Не хватает <b className="price">{rub(short)}</b>. Пополните демо-баланс — это мгновенно и бесплатно.
              </Note>
            )}
          </section>
        </div>

        <aside className="checkout__side">
          <section className="co-card co-summary" aria-labelledby="co-sum">
            <button className="co-summary__head" onClick={() => setShowItems((v) => !v)} aria-expanded={showItems}>
              <span>
                <h2 id="co-sum" className="co-sec__title co-sec__title--flat">Ваш заказ</h2>
                <span className="muted t-sm">{quote ? `${quote.count} ${plural(quote.count, 'блюдо', 'блюда', 'блюд')} · ${quote.restaurant?.name}` : ''}</span>
              </span>
              <Icon name="chevronDown" size={18} className={showItems ? 'rot-180' : ''} />
            </button>
            {showItems && quote && (
              <ul className="co-items fade-in">
                {quote.lines.map((l) => (
                  <li key={l.lineId}>
                    <span className="co-items__img"><Img src={l.image} alt="" /></span>
                    <span className="co-items__name">{l.qty} × {l.name}{l.options.length ? <span className="muted"> · {l.options.join(', ')}</span> : null}</span>
                    <span className="price">{rub(l.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            {quote ? <Breakdown quote={quote} /> : <Skeleton w="100%" h={140} />}
            <div className="co-summary__cta">
              <Button size="lg" block loading={submitting} disabled={!canPay} onClick={pay}>
                Оплатить <Money value={total} />
              </Button>
              <p className="co-demo"><Icon name="info" size={14} /> Демо: заказ не отправляется в настоящий ресторан, списываются только демо-деньги.</p>
            </div>
          </section>
        </aside>
      </div>

      <div className="sticky-cta sticky-cta--mobile">
        <div className="sticky-cta__inner container">
          <Button size="lg" block loading={submitting} disabled={!canPay} onClick={pay}>
            Оплатить <Money value={total} />
          </Button>
        </div>
      </div>
    </div>
  );
}
