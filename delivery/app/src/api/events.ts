// Простая шина событий: сервис сообщает, какие данные изменились,
// хуки UI перезапрашивают нужное. Аналог websocket-уведомлений настоящего бэкенда.

export type Topic = 'catalog' | 'cart' | 'orders' | 'wallet' | 'profile' | 'settings';
export const ALL_TOPICS: Topic[] = ['catalog', 'cart', 'orders', 'wallet', 'profile', 'settings'];

type Listener = (topics: Topic[]) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emit(...topics: Topic[]): void {
  const list = topics.length ? topics : ALL_TOPICS;
  listeners.forEach((fn) => {
    try { fn(list); } catch { /* слушатель не должен ронять сервис */ }
  });
}
