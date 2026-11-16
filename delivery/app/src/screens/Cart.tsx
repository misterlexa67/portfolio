import { useNavigate } from 'react-router-dom';
import { useStore } from '../components/AppStore';
import { CartView } from '../components/CartView';
import { PageHeader } from '../components/Chrome';
import { Button, Money } from '../components/ui';

export function CartScreen() {
  const { quote } = useStore();
  const navigate = useNavigate();
  const hasItems = !!quote?.lines.length;
  const blocker = quote?.blockers.find((b) => b.code === 'min_order' || b.code === 'unavailable' || b.code === 'restaurant_off');

  return (
    <div className="screen cart-screen">
      <PageHeader title="Корзина" back={false} />
      <div className="container cart-screen__body">
        <CartView quote={quote} mode="page" />
      </div>
      {hasItems && quote && (
        <div className="sticky-cta">
          <div className="sticky-cta__inner container">
            {blocker && <p className="sticky-cta__hint">{blocker.message}</p>}
            <Button size="lg" block disabled={!quote.canCheckout} onClick={() => navigate('/checkout')}>
              <span>Оформить заказ</span>
              <span className="btn__aside"><Money value={quote.totals.total} /></span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
