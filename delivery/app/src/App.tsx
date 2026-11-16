import { lazy, Suspense, useEffect } from 'react';
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

const AdminApp = lazy(() => import('./admin/AdminApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function DesktopCart() {
  const { quote } = useStore();
  return (
    <aside className="desk-cart" aria-label="Корзина">
      <div className="desk-cart__inner">
        <CartView quote={quote} mode="panel" />
      </div>
    </aside>
  );
}

function ClientLayout() {
  const { pathname } = useLocation();
  const { quote } = useStore();
  const isHome = pathname === '/';
  // Пока корзина пуста, правой колонки нет — контент занимает всю ширину.
  // Колонка с корзиной появляется после первого добавленного блюда.
  const cartEmpty = !quote?.lines.length;
  const fullWidth = cartEmpty || ['/checkout', '/cart'].includes(pathname) || pathname.startsWith('/order');
  const noNav = pathname === '/checkout';
  return (
    <div className={`client${isHome ? ' is-home' : ''}${noNav ? ' no-nav' : ''}`}>
      <AppHeader />
      <div className={`client__body${fullWidth ? ' is-full' : ''}`}>
        <main className="client__main" key={pathname}>
          <Outlet />
        </main>
        {!fullWidth && <DesktopCart />}
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
