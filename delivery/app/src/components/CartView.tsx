import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toFriendly, type Quote } from '../api';
import { Icon } from './Icon';
import { Button, EmptyState, Img, Money, Note, Stepper } from './ui';
import { useToast } from './Toast';
import { AnimatedList, LEAVE_DURATION } from './AnimatedList';
import { rub, eta } from '../lib/format';
import { Confirm } from './Sheet';

export function MinOrderProgress({ quote }: { quote: Quote }) {
  if (!quote.restaurant || quote.minOrder === 0 || quote.totals.items === 0 || quote.minOrderLeft === 0) return null;
  const pct = Math.min(1, quote.totals.items / quote.minOrder);
  const done = quote.minOrderLeft === 0;
  return (
    <div className={`min-progress${done ? ' is-done' : ''}`}>
      <div className="min-progress__text">
        {done ? <><Icon name="check" size={16} stroke={2.2} /> Минимальная сумма заказа набрана</> : <>Ещё <b className="price">{rub(quote.minOrderLeft)}</b> до минимального заказа</>}
      </div>
      <div className="min-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={quote.minOrder} aria-valuenow={quote.totals.items} aria-label="Сумма до минимального заказа">
        <span style={{ transform: `scaleX(${pct})` }} />
      </div>
    </div>
  );
}

export function Breakdown({ quote, compact }: { quote: Quote; compact?: boolean }) {
  const t = quote.totals;
  return (
    <dl className={`breakdown${compact ? ' breakdown--compact' : ''}`}>
      <div><dt>Блюда</dt><dd><Money value={t.items} /></dd></div>
      <div>
        <dt>Доставка{quote.zone ? <span className="breakdown__hint"> · {quote.zone.name}</span> : null}</dt>
        <dd>{quote.zone ? (t.delivery === 0 ? <span className="is-free">Бесплатно</span> : <Money value={t.delivery} />) : <span className="muted">укажите адрес</span>}</dd>
      </div>
      <div><dt>Сервисный сбор</dt><dd><Money value={t.service} /></dd></div>
      {t.discount > 0 && <div className="breakdown__discount"><dt>Скидка{quote.promo ? ` · ${quote.promo.code}` : ''}</dt><dd>−<Money value={t.discount} /></dd></div>}
      <div className="breakdown__total"><dt>Итого</dt><dd><Money value={t.total} /></dd></div>
    </dl>
  );
}

function PromoField({ quote }: { quote: Quote }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const q = await api.cart.applyPromo(code);
      setCode('');
      toast({ text: `Промокод ${q.promo?.code} применён: −${rub(q.totals.discount)}`, tone: 'success', icon: 'tag' });
    } catch (err) {
      setError(toFriendly(err).message);
    } finally { setBusy(false); }
  };

  if (quote.promo) {
    return (
      <div className={`promo-applied${quote.promo.applied ? '' : ' is-inactive'}`}>
        <Icon name="tag" size={18} />
        <div className="promo-applied__text">
          <b>{quote.promo.code}</b>
          <span>{quote.promo.applied ? `−${rub(quote.promo.discount)} · ${quote.promo.message}` : quote.promo.message}</span>
        </div>
        <button className="icon-btn" aria-label="Убрать промокод" onClick={() => api.cart.removePromo()}><Icon name="close" size={18} /></button>
      </div>
    );
  }
  return (
    <form className="promo" onSubmit={apply} noValidate>
      <label htmlFor="promo" className="sr-only">Промокод</label>
      <div className={`promo__field${error ? ' has-error' : ''}`}>
        <Icon name="tag" size={18} />
        <input
          id="promo"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null); }}
          placeholder="Промокод"
          autoCapitalize="characters"
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={!!error}
          aria-describedby={error ? 'promo-err' : undefined}
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!code.trim()}>Применить</Button>
      </div>
      {error ? <p className="field__error" id="promo-err" role="alert">{error}</p> : <p className="field__hint">Попробуйте <button type="button" className="link" onClick={() => setCode('ЕСТЬ10')}>ЕСТЬ10</button> — минус 10% на заказ</p>}
    </form>
  );
}

export function CartView({ quote: live, mode }: { quote: Quote | undefined; mode: 'page' | 'panel' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [comment, setComment] = useState(live?.comment ?? '');
  const commentTimer = useRef<number>();

  // Когда убрали последнее блюдо — даём строке спокойно уйти, и только потом показываем пустую корзину
  const lastFull = useRef<Quote | undefined>(live);
  const prevCount = useRef(live?.lines.length ?? 0);
  const emptyAt = useRef(0);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const count = live?.lines.length ?? 0;
  if (count > 0) { lastFull.current = live; emptyAt.current = 0; }
  else if (prevCount.current > 0 && live) emptyAt.current = Date.now();
  prevCount.current = count;
  const emptying = emptyAt.current > 0 && Date.now() - emptyAt.current < LEAVE_DURATION + 40;
  useEffect(() => {
    if (!emptying) return undefined;
    const t = setTimeout(force, LEAVE_DURATION + 60);
    return () => clearTimeout(t);
  }, [emptying]);
  const quote = live && !live.lines.length && emptying ? lastFull.current : live;

  useEffect(() => { setComment(quote?.comment ?? ''); }, [quote?.restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quote || !live) return <div className="cart-view cart-view--loading" aria-busy="true" />;

  if (!quote.lines.length) {
    return (
      <div className={`cart-view cart-view--${mode}`}>
        <EmptyState
          art="bag"
          title="В корзине пока пусто"
          text={mode === 'panel' ? 'Добавьте блюда — они появятся здесь.' : 'Загляните в рестораны рядом: доставим горячим за полчаса.'}
          action={mode === 'page' ? <Button onClick={() => navigate('/')}>Выбрать ресторан</Button> : undefined}
        />
      </div>
    );
  }

  const setQty = (lineId: string, qty: number) => api.cart.setQty(lineId, qty).catch((e) => toast({ text: toFriendly(e).message, tone: 'danger' }));
  const unavailable = quote.lines.some((l) => !l.available);

  return (
    <div className={`cart-view cart-view--${mode}${emptying && !live.lines.length ? ' is-emptying' : ''}`}>
      <div className="cart-view__head">
        <div>
          {mode === 'panel' && <h2 className="cart-view__title">Корзина</h2>}
          <Link to={`/r/${quote.restaurant?.id}`} className="cart-view__rest">{quote.restaurant?.name}<Icon name="chevronRight" size={16} /></Link>
          {quote.eta && <span className="cart-view__eta num"><Icon name="clock" size={14} /> {eta(quote.eta)}</span>}
        </div>
        <button className="link link--muted" onClick={() => setConfirmClear(true)}>Очистить</button>
      </div>

      <MinOrderProgress quote={quote} />

      {quote.blockers.filter((b) => b.code === 'closed' || b.code === 'restaurant_off').map((b) => <Note key={b.code} tone="warn" icon="clock">{b.message}</Note>)}
      {unavailable && (
        <Note tone="danger" icon="info" action={<Button size="sm" variant="secondary" onClick={() => api.cart.removeUnavailable()}>Убрать</Button>}>
          {quote.blockers.find((b) => b.code === 'unavailable')?.message}
        </Note>
      )}

      <AnimatedList
        className="cart-lines"
        itemClassName="cart-line-wrap"
        items={live.lines}
        getKey={(l) => l.lineId}
        render={(l, phase) => (
          <div className={`cart-line${l.available ? '' : ' is-off'}`}>
            <div className="cart-line__img"><Img src={l.image} alt="" /></div>
            <div className="cart-line__body">
              <span className="cart-line__name">{l.name}</span>
              {l.options.length > 0 && <span className="cart-line__opts">{l.options.join(', ')}</span>}
              <span className="cart-line__price price">{l.available ? <Money value={l.total} /> : 'Нет в наличии'}</span>
            </div>
            {l.available
              ? <Stepper size="sm" value={l.qty} onChange={(v) => setQty(l.lineId, v)} label={`Количество «${l.name}»`} disabled={phase === 'leaving'} />
              : <button className="icon-btn" aria-label={`Убрать «${l.name}»`} onClick={() => setQty(l.lineId, 0)}><Icon name="trash" size={18} /></button>}
          </div>
        )}
      />

      {mode === 'page' && (
        <div className="cart-extras">
          <div className="cart-row">
            <span className="cart-row__icon"><Icon name="cutlery" size={20} /></span>
            <span className="cart-row__label">Приборы<span className="cart-row__hint">{quote.cutlery === 0 ? 'Не кладём — спасибо за заботу о природе' : 'Положим в пакет'}</span></span>
            <Stepper size="sm" value={quote.cutlery} onChange={(v) => api.cart.setCutlery(v)} max={10} zeroLabel="Нет" label="Количество приборов" />
          </div>
          <details className="cart-comment" open={!!comment}>
            <summary className="cart-row">
              <span className="cart-row__icon"><Icon name="chat" size={20} /></span>
              <span className="cart-row__label">Комментарий для ресторана<span className="cart-row__hint">{comment || 'Без лука, соус отдельно — что угодно'}</span></span>
              <Icon name="chevronDown" size={18} className="cart-comment__chev" />
            </summary>
            <label className="sr-only" htmlFor="cart-comment">Комментарий для ресторана</label>
            <textarea
              id="cart-comment"
              className="input input--area"
              rows={2}
              maxLength={300}
              placeholder="Например, без лука или соус отдельно"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                window.clearTimeout(commentTimer.current);
                const v = e.target.value;
                commentTimer.current = window.setTimeout(() => { api.cart.setComment(v); }, 400);
              }}
            />
          </details>
          <PromoField quote={quote} />
        </div>
      )}

      <div className="cart-summary">
        <Breakdown quote={quote} compact={mode === 'panel'} />
        <Button size="lg" block disabled={!quote.canCheckout} onClick={() => navigate('/checkout')} className={mode === 'page' ? 'cart-summary__desk' : ''}>
          {mode === 'page' ? <><span>Оформить заказ</span><span className="btn__aside price">{rub(quote.totals.total)}</span></> : 'Оформить заказ'}
        </Button>
        {mode === 'page' && !quote.canCheckout && quote.blockers[0] && <p className="cart-summary__hint cart-summary__desk">{quote.blockers.find((b) => ['min_order', 'unavailable', 'restaurant_off'].includes(b.code))?.message}</p>}
      </div>

      <Confirm
        open={confirmClear}
        title="Очистить корзину?"
        text="Все блюда из корзины будут удалены."
        confirmLabel="Очистить"
        danger
        onConfirm={async () => { setConfirmClear(false); await api.cart.clear(); toast({ text: 'Корзина очищена', icon: 'trash' }); }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
