import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/controls.css';
import { IsoDefs } from '../components/iso/materials';
import { ToastProvider } from '../components/ui';
import { initReveals } from '../lib/motion';
import { CalcProvider, scrollToId } from '../state/calc';
import { ContinueBanner, Footer, Header, StickyBar } from '../sections/chrome/Chrome';
import { Hero } from '../sections/hero/Hero';
import { HousePicker } from '../sections/house/HousePicker';
import { Calculator } from '../sections/calc/Calculator';
import { EstimateSection } from '../sections/estimate/Estimate';
import { Budgets } from '../sections/budgets/Budgets';
import { ProjectsMap } from '../sections/map/ProjectsMap';
import { Process } from '../sections/process/Process';
import { Faq } from '../sections/faq/Faq';
import { Booking } from '../sections/booking/Booking';

function Landing() {
  useEffect(() => {
    const kill = initReveals();
    // открыли ссылку на смету — сразу к ней
    if (new URLSearchParams(window.location.search).get('calc') === '1') {
      window.setTimeout(() => scrollToId('smeta'), 500);
    }
    return kill;
  }, []);
  return (
    <>
      <IsoDefs />
      <a className="vh" href="#calc">Перейти к калькулятору</a>
      <Header />
      <main>
        <Hero />
        <HousePicker />
        <Calculator />
        <EstimateSection />
        <Budgets />
        <ProjectsMap />
        <Process />
        <Faq />
        <Booking />
      </main>
      <Footer />
      <StickyBar />
      <ContinueBanner />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <CalcProvider>
        <Landing />
      </CalcProvider>
    </ToastProvider>
  </StrictMode>,
);
