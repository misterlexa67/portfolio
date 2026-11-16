// Обёртка над localStorage: любые обращения в try/catch,
// при недоступности хранилища работаем в памяти (приватный режим, запрет cookies).

const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      const s = ls();
      if (s) return s.getItem(key);
    } catch { /* ignore */ }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try { ls()?.setItem(key, value); } catch { /* квота или запрет — остаёмся в памяти */ }
  },
  remove(key: string): void {
    memory.delete(key);
    try { ls()?.removeItem(key); } catch { /* ignore */ }
  },
};

export const session = {
  get(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return memory.get('s:' + key) ?? null; }
  },
  set(key: string, value: string): void {
    memory.set('s:' + key, value);
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key: string): void {
    memory.delete('s:' + key);
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  },
};
