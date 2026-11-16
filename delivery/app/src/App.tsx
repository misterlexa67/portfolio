import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { StoreProvider, useStore } from './components/AppStore';
import { ActiveOrderBar, AppHeader, BottomNav } from './components/Chrome';
import { CartView } from './components/CartView';
import { Home } from './screens/Home';
import { Search } from './screens/Search';
import { RestaurantScreen } from './screens/Restaurant';
import { CartScreen } from './screens/Cart';
import { Checkout } from './screens/Checkout';
import { OrderScreen } from './screens/Order';
import { ProfileScreen } from './screens/Profile';
import { NotFound } from './screens/NotFound';
import { Skeleton } from './components/ui';
import { useDesktop } from './lib/useMedia';

const AdminApp = lazy(() => import('./admin/AdminApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function DesktopCart({ leaving }: { leaving: boolean }) {
  const { quote } = useStore();
  return (
    <aside className={`desk-cart${leaving ? ' is-leaving' : ''}`} aria-label="Корзина" aria-hidden={leaving || undefined}>
      <div className="desk-cart__inner">
        <CartView quote={quote} mode="panel" />
      </div>
    </aside>
  );
}

const ASIDE_LEAVE_MS = 240;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** FLIP: карточки плавно переезжают на новые места, когда меняется ширина колонки. */
function captureCards(): Map<Element, DOMRect> {
  const map = new Map<Element, DOMRect>();
  const vh = window.innerHeight;
  document.querySelectorAll('.client__main .rcard, .client__main .dcard').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > -200 && r.top < vh + 200) map.set(el, r);
  });
  return map;
}
function playCards(before: Map<Element, DOMRect>) {
  before.forEach((old, el) => {
    if (!el.isConnected) return;
    const now = el.getBoundingClientRect();
    if (!now.width) return;
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    const s = old.width / now.width;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
    (el as HTMLElement).animate(
      [
        { transformOrigin: '0 0', transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s})` },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: 380, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    );
  });
}

function ClientLayout() {
  const { pathname } = useLocation();
  const { quote } = useStore();
  const desktop = useDesktop();
  const isHome = pathname === '/';
  const routeFull = ['/checkout', '/cart'].includes(pathname) || pathname.startsWith('/order');
  // Пока корзина пуста, правой колонки нет — контент занимает всю ширину.
  // Колонка с корзиной выезжает после первого блюда и плавно уезжает, когда корзину опустошили.
  const wantAside = !routeFull && !!quote?.lines.length;
  const [aside, setAside] = useState<'hidden' | 'shown' | 'leaving'>(wantAside ? 'shown' : 'hidden');

  useEffect(() => {
    if (wantAside) { setAside('shown'); return undefined; }
    if (aside !== 'shown') return undefined;
    if (!desktop || routeFull || reducedMotion()) { setAside('hidden'); return undefined; }
    setAside('leaving');
    const t = setTimeout(() => setAside('hidden'), ASIDE_LEAVE_MS);
    return () => clearTimeout(t);
  }, [wantAside]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullWidth = routeFull || aside === 'hidden';

  // снимок позиций карточек до перестройки (во время рендера DOM ещё старый)
  const prevFull = useRef(fullWidth);
  const snapshot = useRef<Map<Element, DOMRect> | null>(null);
  if (prevFull.current !== fullWidth) {
    if (desktop && !routeFull && !reducedMotion() && typeof document !== 'undefined') snapshot.current = captureCards();
    prevFull.current = fullWidth;
  }
  useLayoutEffect(() => {
    const s = snapshot.current;
    snapshot.current = null;
    if (s) playCards(s);
  }, [fullWidth]);
  const noNav = pathname === '/checkout';
  return (
    <div className={`client${isHome ? ' is-home' : ''}${noNav ? ' no-nav' : ''}`}>
      <AppHeader />
      <div className={`client__body${fullWidth ? ' is-full' : ''}`}>
        <main className="client__main" key={pathname}>
          <Outlet />
        </main>
        {!fullWidth && <DesktopCart leaving={aside === 'leaving'} />}
      </div>
      <ActiveOrderBar />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<div className="container page-pad"><Skeleton w="100%" h={240} r={20} /></div>}>
                <AdminApp />
              </Suspense>
            }
          />
          <Route element={<StoreProvider><ClientLayout /></StoreProvider>}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/r/:id" element={<RestaurantScreen />} />
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<OrderScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </HashRouter>
  );
}
