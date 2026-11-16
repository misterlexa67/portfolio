// Все ошибки сервисного слоя — человеческие, на русском. UI показывает только `message`.

export type ErrorCode =
  | 'network'
  | 'not_found'
  | 'cart_conflict'
  | 'cart_empty'
  | 'dish_unavailable'
  | 'restaurant_closed'
  | 'restaurant_off'
  | 'min_order'
  | 'no_address'
  | 'out_of_zone'
  | 'insufficient_funds'
  | 'promo_invalid'
  | 'promo_min_subtotal'
  | 'invalid'
  | 'slot_invalid'
  | 'unauthorized'
  | 'conflict';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Любая непредвиденная ошибка превращается в дружелюбное сообщение. */
export function toFriendly(e: unknown): ApiError {
  if (isApiError(e)) return e;
  return new ApiError('network', 'Связь пропала на секунду. Попробуйте ещё раз — мы ничего не потеряли.');
}
