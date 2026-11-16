import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api, isApiError, STATUS_LABEL, subscribe, toFriendly,
  type Address, type Order, type Profile, type Quote, type Tracking, type Wallet,
} from '../api';
import { useToast } from './Toast';
import { Confirm } from './Sheet';
import { DishSheet } from './DishSheet';
import { AddressSheet } from './AddressSheet';
import { TopUpSheet } from './TopUpSheet';
import { flyToCart } from '../lib/fly';
import { plural } from '../lib/format';

interface Store {
  quote: Quote | undefined;
  wallet: Wallet | undefined;
  profile: Profile | undefined;
  address: Address | null;
  active: { order: Order; tracking: Tracking }[];
  cartQty: (dishId: string) => number;
  addToCart: (dishId: string, optionIds: string[], qty: number, fly?: { el: HTMLElement | null; image: string }) => Promise<boolean>;
  setDishQty: (dishId: string, qty: number) => Promise<void>;
  repeatOrder: (orderId: string) => Promise<void>;
  openDish: (dishId: string) => void;
  openAddress: () => void;
  openTopUp: (missing?: number) => void;
  toggleFavoriteRestaurant: (id: string) => Promise<void>;
  toggleFavoriteDish: (id: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

type ConflictState = { current: string; next: string; resolve: (ok: boolean) => void } | null;

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote>();
  const [wallet, setWallet] = useState<Wallet>();
  const [profile, setProfile] = useState<Profile>();
  const [active, setActive] = useState<{ order: Order; tracking: Tracking }[]>([]);
  const [dishId, setDishId] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [topUp, setTopUp] = useState<{ open: boolean; missing?: number }>({ open: false });
  const [conflict, setConflict] = useState<ConflictState>(null);
  const lastStatuses = useRef(new Map<string, string>());

  const loadCart = useCallback(() => api.cart.get().then(setQuote, () => {}), []);
  const loadWallet = useCallback(() => api.wallet.get().then(setWallet, () => {}), []);
  const loadProfile = useCallback(() => api.profile.get().then(setProfile, () => {}), []);
  const loadActive = useCallback(() => api.orders.active().then((list) => {
    // уведомляем о смене статуса, если пользователь не смотрит на этот заказ
    list.forEach(({ order }) => {
      const prev = lastStatuses.current.get(order.id);
      if (prev && prev !== order.status && !window.location.hash.includes(order.id)) {
        toast({ text: `Заказ №${order.number}: ${STATUS_LABEL[order.status].toLowerCase()}`, icon: 'scooter', action: { label: 'Открыть', onClick: () => navigate(`/order/${order.id}`) } });
      }
      lastStatuses.current.set(order.id, order.status);
    });
    setActive(list);
  }, () => {}), [toast, navigate]);

  useEffect(() => {
    loadCart(); loadWallet(); loadProfile(); loadActive();
    return subscribe((topics) => {
      if (topics.includes('cart') || topics.includes('catalog') || topics.includes('settings') || topics.includes('profile')) loadCart();
      if (topics.includes('wallet')) loadWallet();
      if (topics.includes('profile')) loadProfile();
      if (topics.includes('orders')) loadActive();
    });
  }, [loadCart, loadWallet, loadProfile, loadActive]);

  // пока есть активный заказ — сервис продвигает статусы, мы их опрашиваем
  useEffect(() => {
    if (!active.length) return undefined;
    const t = setInterval(loadActive, 2000);
    return () => clearInterval(t);
  }, [active.length, loadActive]);

  const askConflict = useCallback((current: string, next: string) => new Promise<boolean>((resolve) => {
    setConflict({ current, next, resolve });
  }), []);

  const withConflict = useCallback(async <T,>(fn: (replace: boolean) => Promise<T>): Promise<T | null> => {
    try {
      return await fn(false);
    } catch (e) {
      if (isApiError(e) && e.code === 'cart_conflict') {
        const ok = await askConflict(String(e.details.current), String(e.details.next));
        if (!ok) return null;
        return fn(true);
      }
      throw e;
    }
  }, [askConflict]);

  const addToCart = useCallback(async (id: string, optionIds: string[], qty: number, fly?: { el: HTMLElement | null; image: string }) => {
    try {
      const q = await withConflict((replace) => api.cart.add(id, optionIds, qty, { replace }));
      if (!q) return false;
      setQuote(q);
      if (fly) flyToCart(fly.el, fly.image);
      return true;
    } catch (e) {
      toast({ text: toFriendly(e).message, tone: 'danger' });
      return false;
    }
  }, [withConflict, toast]);

  const setDishQty = useCallback(async (id: string, qty: number) => {
    try { setQuote(await api.cart.setDishQty(id, qty)); } catch (e) { toast({ text: toFriendly(e).message, tone: 'danger' }); }
  }, [toast]);

  const repeatOrder = useCallback(async (orderId: string) => {
    try {
      const res = await withConflict((replace) => api.orders.repeat(orderId, { replace }));
      if (!res) return;
      setQuote(res.quote);
      if (res.skipped.length) {
        toast({ text: `Добавили ${res.added} ${plural(res.added, 'блюдо', 'блюда', 'блюд')}. Нет в наличии: ${res.skipped.join(', ')}`, icon: 'info' });
      } else {
        toast({ text: 'Собрали корзину по прошлому заказу', tone: 'success' });
      }
      navigate('/cart');
    } catch (e) {
      toast({ text: toFriendly(e).message, tone: 'danger' });
    }
  }, [withConflict, toast, navigate]);

  const toggleFavoriteRestaurant = useCallback(async (id: string) => {
    const on = await api.profile.toggleFavoriteRestaurant(id);
    toast({ text: on ? 'Добавили в избранное' : 'Убрали из избранного', icon: 'heart' });
  }, [toast]);
  const toggleFavoriteDish = useCallback(async (id: string) => {
    const on = await api.profile.toggleFavoriteDish(id);
    toast({ text: on ? 'Блюдо в избранном' : 'Убрали из избранного', icon: 'heart' });
  }, [toast]);

  const value = useMemo<Store>(() => ({
    quote, wallet, profile, active,
    address: profile?.addresses.find((a) => a.id === profile.selectedAddressId) ?? null,
    cartQty: (id) => quote?.lines.filter((l) => l.dishId === id).reduce((s, l) => s + l.qty, 0) ?? 0,
    addToCart, setDishQty, repeatOrder,
    openDish: (id) => setDishId(id),
    openAddress: () => setAddressOpen(true),
    openTopUp: (missing) => setTopUp({ open: true, missing }),
    toggleFavoriteRestaurant, toggleFavoriteDish,
  }), [quote, wallet, profile, active, addToCart, setDishQty, repeatOrder, toggleFavoriteRestaurant, toggleFavoriteDish]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DishSheet dishId={dishId} onClose={() => setDishId(null)} />
      <AddressSheet open={addressOpen} onClose={() => setAddressOpen(false)} />
      <TopUpSheet open={topUp.open} missing={topUp.missing} onClose={() => setTopUp({ open: false })} />
      <Confirm
        open={!!conflict}
        title="Очистить корзину?"
        text={conflict ? <>В корзине блюда из «{conflict.current}». Заказать можно из одного ресторана — очистить корзину и добавить блюда из «{conflict.next}»?</> : null}
        confirmLabel="Очистить и добавить"
        cancelLabel="Оставить как есть"
        onConfirm={() => { conflict?.resolve(true); setConflict(null); }}
        onClose={() => { conflict?.resolve(false); setConflict(null); }}
      />
    </Ctx.Provider>
  );
}
