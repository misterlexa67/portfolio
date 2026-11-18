import { useEffect, useState } from 'react';
import { api, toFriendly } from '../api';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { useStore } from './AppStore';
import { useToast } from './Toast';
import { rub } from '../lib/format';

const AMOUNTS = [500, 1000, 3000, 5000];

export function TopUpSheet({ open, missing, onClose }: { open: boolean; missing?: number; onClose: () => void }) {
  const { wallet } = useStore();
  const toast = useToast();
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAmount(missing ? Math.max(500, Math.ceil(missing / 500) * 500) : 1000);
  }, [open, missing]);

  const submit = async () => {
    setBusy(true);
    try {
      const w = await api.wallet.topUp(amount);
      toast({ text: `Баланс пополнен: ${rub(w.balance)}`, tone: 'success', icon: 'wallet' });
      onClose();
    } catch (e) {
      toast({ text: toFriendly(e).message, tone: 'danger' });
    } finally { setBusy(false); }
  };

  const options = Array.from(new Set([...(missing ? [Math.max(500, Math.ceil(missing / 500) * 500)] : []), ...AMOUNTS])).sort((a, b) => a - b).slice(0, 4);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Пополнить баланс"
      footer={<Button size="lg" block loading={busy} onClick={submit}>Пополнить на <span className="price">{rub(amount)}</span></Button>}
    >
      <p className="sheet-lead">Сейчас на балансе <b className="price">{rub(wallet?.balance ?? 0)}</b>{missing ? <> — для заказа не хватает <b className="price">{rub(missing)}</b></> : null}.</p>
      <div className="amounts" role="radiogroup" aria-label="Сумма пополнения">
        {options.map((a) => (
          <button key={a} role="radio" aria-checked={amount === a} className={`amount${amount === a ? ' is-on' : ''}`} onClick={() => setAmount(a)}>
            <span className="price">{rub(a)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
