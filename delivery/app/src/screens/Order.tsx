import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, courierPosition, isApiError, subscribe, toFriendly, type Order, type OrderStatus, type Point, type Tracking } from '../api';
import { useStore } from '../components/AppStore';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/Chrome';
import { CityMap } from '../components/CityMap';
import { Button, EmptyState, Img, Note, Skeleton } from '../components/ui';
import { Icon } from '../components/Icon';
import { hm, plural, rub, when } from '../lib/format';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'cooking', label: 'Готовит' },
  { status: 'picked_up', label: 'Забрал' },
  { status: 'on_the_way', label: 'В пути' },
  { status: 'at_door', label: 'У двери' },
  { status: 'delivered', label: 'Доставлен' },
];
const ORDER: OrderStatus[] = ['created', 'paid_demo', 'cooking', 'picked_up', 'on_the_way', 'at_door', 'delivered'];

const HEADLINE: Record<OrderStatus, string> = {
  created: 'Создаём заказ',
  paid_demo: 'Заказ оплачен',
  cooking: 'Ресторан готовит',
  picked_up: 'Курьер забрал заказ',
  on_the_way: 'Курьер в пути',
  at_door: 'Курьер у двери',
  delivered: 'Доставлен',
  cancelled: 'Заказ отменён',
};

function useCourier(order: Order | undefined, tracking: Tracking | undefined): Point | null {
  const [pos, setPos] = useState<Point | null>(null);
  const offset = useRef(0);
  useEffect(() => {
    if (!order || !tracking) return undefined;
    offset.current = tracking.serverNow - Date.now(); // часы сервиса
    let raf = 0;
    const tick = () => {
      setPos(courierPosition(order, tracking, Date.now() + offset.current));
      if (order.status === 'on_the_way') raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [order, tracking]);
  return pos;
}

function Steps({ status }: { status: OrderStatus }) {
  const idx = ORDER.indexOf(status);
  return (
    <ol className="steps" aria-label="Этапы заказа">
      {STEPS.map((s) => {
        const si = ORDER.indexOf(s.status);
        const state = idx > si ? 'done' : idx === si ? 'now' : 'next';
        return (
          <li key={s.status} className={`step step--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step__bar"><span /></span>
            <span className="step__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function RateBlock({ order }: { order: Order }) {
  const toast = useToast();
  const { wallet, openTopUp, repeatOrder } = useStore();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (order.rating) {
    return (
      <section className="co-card rate rate--done fade-in">
        <div className="rate__thanks">
          <span className="rate__check"><Icon name="check" size={22} stroke={2.2} /></span>
          <div>
            <h2 className="h3">Спасибо за оценку!</h2>
            <p className="muted">
              <span className="stars-static" aria-label={`${order.rating.stars} из 5`}>{'★'.repeat(order.rating.stars)}<span>{'★'.repeat(5 - order.rating.stars)}</span></span>
              {order.tip ? ` · чаевые ${rub(order.tip)} курьеру ${order.courier.name}` : ''}
            </p>
          </div>
        </div>
        <Button icon="refresh" variant="secondary" block size="lg" onClick={() => repeatOrder(order.id)}>Повторить заказ</Button>
      </section>
    );
  }

  const submit = async () => {
    if (!stars) { toast({ text: 'Поставьте оценку — от 1 до 5 звёзд', icon: 'star' }); return; }
    setBusy(true);
    try {
      if (tip && order.tip === 0) await api.orders.tip(order.id, tip);
      await api.orders.rate(order.id, stars, comment);
      toast({ text: tip ? `Спасибо! ${order.courier.name} получит ${rub(tip)}` : 'Спасибо за оценку!', tone: 'success' });
    } catch (e) {
      const err = toFriendly(e);
      if (isApiError(err) && err.code === 'insufficient_funds') openTopUp(Number(err.details.missing) || undefined);
      toast({ text: err.message, tone: 'danger' });
    } finally { setBusy(false); }
  };

  const labels = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

  return (
    <section className="co-card rate fade-in" aria-labelledby="rate-title">
      <h2 className="h3" id="rate-title">Как вам заказ?</h2>
      <div className="stars" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} из 5 — ${labels[n]}`} className={`star${n <= stars ? ' is-on' : ''}`} onClick={() => setStars(n)}>
            <Icon name="star" size={34} filled={n <= stars} stroke={1.5} />
          </button>
        ))}
      </div>
      <p className="rate__label">{stars ? labels[stars] : 'Нажмите на звезду'}</p>
      <label htmlFor="rate-comment" className="sr-only">Комментарий</label>
      <textarea id="rate-comment" className="input input--area" rows={2} maxLength={500} placeholder="Что понравилось или что улучшить? (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="tips">
        <p className="tips__title">Чаевые курьеру {order.courier.name}<span className="muted"> · с баланса</span></p>
        <div className="choice-row">
          {[50, 100, 150].map((a) => (
            <button key={a} className={`choice${tip === a ? ' is-on' : ''}`} aria-pressed={tip === a} onClick={() => setTip(tip === a ? null : a)} disabled={(wallet?.balance ?? 0) < a && tip !== a}>
              <span className="price">{rub(a)}</span>
            </button>
          ))}
        </div>
      </div>
      <Button size="lg" block loading={busy} onClick={submit}>{tip ? `Отправить и оставить ${rub(tip)}` : 'Отправить оценку'}</Button>
    </section>
  );
}

export function OrderScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { repeatOrder } = useStore();
  const [data, setData] = useState<{ order: Order; tracking: Tracking } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = () => api.orders.get(id).then((d) => {
      if (!alive) return;
      setData(d);
      setError(null);
      clearTimeout(timer);
      if (!['delivered', 'cancelled'].includes(d.order.status)) timer = window.setTimeout(load, 1000);
    }, (e) => { if (alive) { setError(toFriendly(e).message); timer = window.setTimeout(load, 3000); } });
    load();
    // оценка, чаевые, отмена из админки — сервис сообщает об изменении
    const unsub = subscribe((topics) => { if (topics.includes('orders')) load(); });
    return () => { alive = false; clearTimeout(timer); unsub(); };
  }, [id]);

  const order = data?.order;
  const tracking = data?.tracking;
  const courier = useCourier(order, tracking);
  const focus = useMemo(() => (order ? order.route : undefined), [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) {
    return (
      <div className="screen">
        <PageHeader title="Заказ" />
        <div className="container"><EmptyState art="receipt" title="Заказ не найден" text={error} action={<Button onClick={() => navigate('/profile')}>К моим заказам</Button>} /></div>
      </div>
    );
  }

  const status = order?.status;
  const showCourier = status && ['picked_up', 'on_the_way', 'at_door'].includes(status);
  const arrival = tracking?.minutesLeft !== null && tracking?.minutesLeft !== undefined ? Date.now() + tracking.minutesLeft * 60000 : null;

  const cancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      await api.orders.cancel(order.id);
      toast({ text: `Заказ отменён, ${rub(order.totals.total)} вернулись на баланс`, tone: 'success' });
      setData(await api.orders.get(order.id));
    } catch (e) { toast({ text: toFriendly(e).message, tone: 'danger' }); } finally { setCancelling(false); }
  };

  return (
    <div className="screen order">
      <PageHeader title={order ? `Заказ №${order.number}` : 'Заказ'} sub={order ? `${order.restaurant.name} · ${when(order.createdAt)}` : undefined} />

      <div className="container order__grid">
        <div className="order__map">
          {order ? (
            <CityMap
              label={`Карта: ${HEADLINE[order.status]}`}
              focus={focus}
              compactLabels
              route={order.status === 'cancelled' ? undefined : order.route}
              courier={showCourier || status === 'delivered' ? courier : null}
              pins={[
                { id: 'r', kind: 'restaurant', point: order.restaurant.location, label: order.restaurant.name },
                { id: 'h', kind: 'home', point: order.address.point },
              ]}
            />
          ) : <Skeleton w="100%" h="100%" r={0} />}
        </div>

        <div className="order__panel">
          <section className="co-card status-card" aria-live="polite">
            {!order || !tracking ? <><Skeleton w="60%" h={28} /><Skeleton w="40%" h={18} /></> : (
              <>
                <div className="status-card__top">
                  <div>
                    <h2 className="h2">{HEADLINE[order.status]}</h2>
                    <p className="status-card__sub">
                      {order.status === 'cancelled' && (order.refunded ? `Деньги вернулись на баланс: ${rub(order.totals.total)}` : 'Заказ отменён')}
                      {order.status === 'delivered' && `Приятного аппетита! Доставили ${when(order.history[order.history.length - 1].at)}`}
                      {tracking.startsAt && `Запланирован к ${hm((order.slot as { at: number }).at)} — начнём готовить в ${hm(tracking.startsAt)}`}
                      {!tracking.startsAt && tracking.minutesLeft !== null && order.status !== 'at_door' && `Будет через ${tracking.minutesLeft} ${plural(tracking.minutesLeft, 'минуту', 'минуты', 'минут')} · около ${arrival ? hm(arrival) : ''}`}
                      {order.status === 'at_door' && 'Курьер уже у вас — откройте дверь'}
                    </p>
                  </div>
                  {tracking.minutesLeft !== null && !tracking.startsAt && order.status !== 'at_door' && (
                    <div className="countdown num" aria-label={`Осталось ${tracking.minutesLeft} минут`}>
                      <b>{tracking.minutesLeft}</b><span>мин</span>
                    </div>
                  )}
                </div>
                {order.status !== 'cancelled' && <Steps status={order.status} />}
                {['created', 'paid_demo'].includes(order.status) && (
                  <Button variant="quiet" size="sm" loading={cancelling} onClick={cancel}>Отменить заказ</Button>
                )}
              </>
            )}
          </section>

          {order && showCourier && (
            <section className="co-card courier fade-in" aria-label="Курьер">
              <span className="courier__avatar" aria-hidden="true">{order.courier.name[0]}</span>
              <div className="courier__text">
                <b>{order.courier.name}</b>
                <span className="num">{order.courier.vehicle} · <Icon name="star" size={12} filled /> {order.courier.rating.toFixed(2).replace('.', ',')}</span>
              </div>
              <button className="round-btn" aria-label="Позвонить курьеру" onClick={() => toast({ text: 'Звонок курьеру пока недоступен', icon: 'phone' })}><Icon name="phone" size={19} /></button>
              <button className="round-btn" aria-label="Написать курьеру" onClick={() => toast({ text: 'Чат с курьером пока недоступен', icon: 'chat' })}><Icon name="chat" size={19} /></button>
            </section>
          )}

          {order && order.status === 'delivered' && <RateBlock order={order} />}

          {order && (
            <section className="co-card order-details">
              <h2 className="co-sec__title co-sec__title--flat">Детали заказа</h2>
              <p className="order-details__addr"><Icon name="pin" size={16} /> {order.address.street}{order.address.details.apartment ? `, кв. ${order.address.details.apartment}` : ''}</p>
              <ul className="co-items">
                {order.lines.map((l, i) => (
                  <li key={i}>
                    <span className="co-items__img"><Img src={l.image} alt="" /></span>
                    <span className="co-items__name">{l.qty} × {l.name}{l.options.length ? <span className="muted"> · {l.options.join(', ')}</span> : null}</span>
                    <span className="price">{rub(l.total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="breakdown breakdown--compact">
                <div><dt>Блюда</dt><dd className="price">{rub(order.totals.items)}</dd></div>
                <div><dt>Доставка · {order.zone.name}</dt><dd className="price">{order.totals.delivery ? rub(order.totals.delivery) : 'Бесплатно'}</dd></div>
                <div><dt>Сервисный сбор</dt><dd className="price">{rub(order.totals.service)}</dd></div>
                {order.totals.discount > 0 && <div className="breakdown__discount"><dt>Скидка · {order.promoCode}</dt><dd className="price">−{rub(order.totals.discount)}</dd></div>}
                <div className="breakdown__total"><dt>Оплачено балансом</dt><dd className="price">{rub(order.totals.total)}</dd></div>
              </dl>
              {order.status !== 'delivered' && order.status !== 'cancelled' ? null : (
                <Button variant="secondary" icon="refresh" block onClick={() => repeatOrder(order.id)}>Повторить заказ</Button>
              )}
            </section>
          )}
          {order && order.status === 'cancelled' && <Note icon="info">Можно собрать такую же корзину заново — кнопка «Повторить заказ» выше.</Note>}
        </div>
      </div>
    </div>
  );
}
