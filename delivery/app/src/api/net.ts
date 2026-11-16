// Имитация сети: небольшая задержка и (по желанию владельца) случайные сбои.
// Благодаря этому UI с первого дня написан как для настоящего API: со скелетонами и обработкой ошибок.
import { ApiError, toFriendly } from './errors';
import { read } from './db';

let latency = true;
export function configureNet(opts: { latency: boolean }): void { latency = opts.latency; }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface CallOptions {
  /** Короткая задержка для мгновенных операций (пересчёт цены, степпер). */
  fast?: boolean;
  /** Не подвержено имитации сбоев (например, чтение баланса в шапке). */
  safe?: boolean;
}

export async function call<T>(fn: () => T | Promise<T>, opts: CallOptions = {}): Promise<T> {
  if (latency) await wait(opts.fast ? rand(40, 90) : rand(140, 320));
  if (!opts.safe && latency) {
    const chaos = read((db) => db.settings.simulateErrors);
    if (chaos && Math.random() < 0.2) {
      throw new ApiError('network', 'Не получилось связаться с сервером. Проверьте интернет и попробуйте ещё раз.');
    }
  }
  try {
    return await fn();
  } catch (e) {
    throw toFriendly(e);
  }
}
