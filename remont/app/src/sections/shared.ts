import { api } from '../api';
import { useApi } from '../lib/hooks';
import { dayWord } from '../lib/format';

/** Тексты сайта из админки. */
export const useTexts = () => useApi(() => api.texts.get(), [], ['texts']).data;

/** Ближайший свободный замер: «завтра в 18:00». */
export function useNearest() {
  const { data } = useApi(() => api.slots.nearest(), [], ['bookings', 'exceptions', 'schedule']);
  if (data === undefined) return { loading: true, text: '', short: '', slot: null };
  if (!data) return { loading: false, text: 'Свободных окон пока нет — оставьте заявку', short: 'Окон пока нет', slot: null };
  return { loading: false, text: `Ближайший замер — ${dayWord(data.date)} в ${data.time}`, short: `Замер — ${dayWord(data.date)}, ${data.time}`, slot: data };
}

/** Демо-ссылки мессенджеров: никуда не ведут, честно об этом говорим. */
export const MESSENGERS = [
  { id: 'telegram', label: 'Telegram', icon: 'send' as const },
  { id: 'max', label: 'MAX', icon: 'chat' as const },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'phone' as const },
];
