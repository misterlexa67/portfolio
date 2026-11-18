import { useEffect, useState } from 'react';
import { api, STATUS_LABEL, toFriendly, type Order, type OrderStatus } from '../api';
import { useQuery } from '../lib/useQuery';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { Sheet, Confirm } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { AdminPage, Pill } from './kit';
import { rub, when } from '../lib/format';

const FILTERS: { value: OrderStatus | 'active' | null; label: string }[] = [
  { value: null, label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'cooking', label: 'Готовятся' },
  { value: 'on_the_way', label: 'В пути' },
  { value: 'delivered', label: 'Доставлены' },
  { value: 'cancelled', label: 'Отменены' },
];
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  created: 'Отметить оплату', paid_demo: 'Начать готовить', cooking: 'Передать курьеру',
  picked_up: 'Курьер выехал', on_the_way: 'Курьер у двери', at_door: 'Отметить доставку',
};
const tone = (s: OrderStatus) => (s === 'delivered' ? 'success' : s === 'cancelled' ? 'danger' : 'accent');

function OrderDetails({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (id) api.admin.orders.get(id).then((d) => setOrder(d.order), () => {}); }, [id]);
  const act = async (fn: () => Promise<Order>, msg: string) => {
    setBusy(true);
    try { const o = await fn(); setOrder(o); toast({ text: msg, tone: 'success' }); } catch (e) { toast({ text: toFriendly(e).message, tone: 'danger' }); } finally { setBusy(false); }
  };
  const final = order && ['delivered', 'cancelled'].includes(order.status);
  return (
    <Sheet open={!!id} onClose={onClose} title={order ? `Заказ №${order.number}` : 'Заказ'} size="tall"
      footer={order && !final ? (
        <div className="filters-footer">
          <Button variant="danger" size="lg" onClick={() => setConfirm(true)} disabled={busy}>Отменить</Button>
          <Button size="lg" block loading={busy} onClick={() => act(() => api.admin.orders.advance(order.id), 'Статус обновлён')}>{NEXT_LABEL[order.status]}</Button>
        </div>
      ) : undefined}
    >
      {!order ? <Skeleton h={200} /> : (
        <div className="a-order">
          <div className="a-order__status"><Pill tone={tone(order.status)}>{STATUS_LABEL[order.status]}</Pill><span className="muted t-sm">{when(order.createdAt)}</span></div>
          <dl className="a-dl">
            <div><dt>Клиент</dt><dd>{order.customer.own ? 'Вы' : order.customer.name}</dd></div>
            <div><dt>Ресторан</dt><dd>{order.restaurant.name}</dd></div>
            <div><dt>Адрес</dt><dd>{order.address.street} · {order.zone.name}</dd></div>
            <div><dt>Когда</dt><dd>{order.slot.kind === 'asap' ? 'Как можно скорее' : `Ко времени`}</dd></div>
            <div><dt>Курьер</dt><dd>{order.courier.name}, {order.courier.vehicle.toLowerCase()}</dd></div>
            {order.comment && <div><dt>Комментарий</dt><dd>{order.comment}</dd></div>}
            <div><dt>Приборы</dt><dd>{order.cutlery || 'не нужны'}</dd></div>
          </dl>
          <ul className="co-items">
            {order.lines.map((l, i) => <li key={i}><span className="co-items__name">{l.qty} × {l.name}{l.options.length ? <span className="muted"> · {l.options.join(', ')}</span> : null}</span><span className="price">{rub(l.total)}</span></li>)}
          </ul>
          <dl className="breakdown breakdown--compact">
            <div><dt>Блюда</dt><dd className="price">{rub(order.totals.items)}</dd></div>
            <div><dt>Доставка</dt><dd className="price">{rub(order.totals.delivery)}</dd></div>
            <div><dt>Сервисный сбор</dt><dd className="price">{rub(order.totals.service)}</dd></div>
            {order.totals.discount > 0 && <div className="breakdown__discount"><dt>Скидка {order.promoCode}</dt><dd className="price">−{rub(order.totals.discount)}</dd></div>}
            <div className="breakdown__total"><dt>Итого</dt><dd className="price">{rub(order.totals.total)}</dd></div>
          </dl>
          {order.rating && <p className="t-sm">Оценка: {'★'.repeat(order.rating.stars)} {order.rating.comment && `— «${order.rating.comment}»`}{order.tip ? ` · чаевые ${rub(order.tip)}` : ''}</p>}
          <h3 className="a-card__title">История</h3>
          <ol className="a-history">{order.history.map((h, i) => <li key={i}><span>{STATUS_LABEL[h.status]}</span><span className="muted num">{when(h.at)}</span></li>)}</ol>
        </div>
      )}
      <Confirm open={confirm} title="Отменить заказ?" text={order?.customer.own ? 'Сумма вернётся клиенту на баланс.' : 'Клиент увидит, что заказ отменён рестораном.'} confirmLabel="Отменить заказ" cancelLabel="Не отменять" danger
        onConfirm={() => { setConfirm(false); if (order) act(() => api.admin.orders.cancel(order.id), 'Заказ отменён'); }} onClose={() => setConfirm(false)} />
    </Sheet>
  );
}

export function OrdersAdmin() {
  const [filter, setFilter] = useState<OrderStatus | 'active' | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery(() => api.admin.orders.list(filter), [filter], ['orders']);
  useEffect(() => { const t = setInterval(q.reload, 3000); return () => clearInterval(t); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AdminPage title="Заказы" sub="Статусы идут автоматически (ускоренная симуляция). Можно продвинуть или отменить вручную.">
      <div className="tabs no-scrollbar a-filters">
        {FILTERS.map((f) => <button key={String(f.value)} className={`tab${filter === f.value ? ' is-on' : ''}`} onClick={() => setFilter(f.value)}>{f.label}</button>)}
      </div>
      {q.error && <ErrorState message={q.error.message} onRetry={q.reload} />}
      {q.loading && <Skeleton h={300} r={20} />}
      {q.data && !q.data.length && <EmptyState art="receipt" title="Заказов нет" text="С таким статусом заказов пока нет." />}
      {q.data && q.data.length > 0 && (
        <ul className="a-list a-card">
          {q.data.map((o) => (
            <li key={o.id}>
              <button className="a-list__row a-list__row--btn" onClick={() => setOpen(o.id)}>
                <span className="a-list__main"><b>№{o.number} · {o.restaurant.name}</b><span className="muted t-sm">{o.customer.own ? 'Вы' : o.customer.name} · {o.address.street} · {when(o.createdAt)}</span></span>
                <Pill tone={tone(o.status)}>{STATUS_LABEL[o.status]}</Pill>
                <span className="price a-list__sum">{rub(o.totals.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <OrderDetails id={open} onClose={() => setOpen(null)} />
    </AdminPage>
  );
}
