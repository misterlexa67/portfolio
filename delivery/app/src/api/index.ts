// Единая точка входа сервисного слоя. Чтобы подключить настоящий бэкенд,
// достаточно заменить реализации этих модулей на HTTP-клиент с теми же сигнатурами.
import { catalog } from './catalog';
import { cart } from './cart';
import { orders } from './orders';
import { profile, wallet } from './profile';
import { admin } from './admin';

export const api = { catalog, cart, orders, profile, wallet, admin };

export * from './types';
export { ApiError, isApiError, toFriendly } from './errors';
export { subscribe, type Topic } from './events';
export { courierPosition, STATUS_LABEL, STAGE_SECONDS, ACTIVE, FINAL } from './tracking';
export { MAP_W, MAP_H, VOLGA, OKA, VOLGA_WIDTH, OKA_WIDTH, BRIDGES, LANDMARKS, STREETS, districtOf } from './geo';
export { IMAGE_LIBRARY, COVER_LIBRARY } from './seed';
export { mskLabel } from './time';
export type { RestaurantInput, DishInput, ZoneInput, PromoInput } from './admin';
