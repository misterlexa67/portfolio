import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface ToastInput { text: string; tone?: 'neutral' | 'success' | 'danger'; icon?: IconName; action?: { label: string; onClick: () => void } }
interface ToastItem extends ToastInput { id: number; leaving?: boolean }

const Ctx = createContext<(t: ToastInput | string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 200);
  }, []);

  const show = useCallback((input: ToastInput | string) => {
    const t: ToastInput = typeof input === 'string' ? { text: input } : input;
    const id = ++seq.current;
    setItems((list) => [...list.slice(-1), { ...t, id }]);
    setTimeout(() => dismiss(id), t.action ? 4500 : 2600);
  }, [dismiss]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone ?? 'neutral'}${t.leaving ? ' is-leaving' : ''}`} role={t.tone === 'danger' ? 'alert' : 'status'}>
            <Icon name={t.icon ?? (t.tone === 'success' ? 'check' : t.tone === 'danger' ? 'info' : 'check')} size={18} />
            <span className="toast__text">{t.text}</span>
            {t.action && (
              <button className="toast__action" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
