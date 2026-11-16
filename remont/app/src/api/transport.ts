import { ApiError } from './types';

/* Имитация сети: небольшая задержка, копия данных на выходе, человеческие ошибки.
   При переходе на бэкенд этот файл заменяется на fetch-клиент. */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isTest = typeof process !== 'undefined' && process.env?.VITEST;

export async function call<T>(fn: () => T | Promise<T>, latency: [number, number] = [140, 320]): Promise<T> {
  if (!isTest) await sleep(latency[0] + Math.random() * (latency[1] - latency[0]));
  try {
    const result = await fn();
    return result === undefined ? result : (JSON.parse(JSON.stringify(result)) as T);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error(e);
    throw new ApiError('storage', 'Что-то пошло не так. Обновите страницу и попробуйте ещё раз.');
  }
}

/** Последовательное выполнение критических секций (бронь слота). */
let chain: Promise<unknown> = Promise.resolve();
export function exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
