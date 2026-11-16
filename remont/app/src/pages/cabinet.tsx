import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/controls.css';
import '../sections/chrome/chrome.css';
import { IsoDefs } from '../components/iso/materials';
import { ToastProvider } from '../components/ui';
import { CabinetApp } from '../cabinet/Cabinet';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <IsoDefs />
      <CabinetApp />
    </ToastProvider>
  </StrictMode>,
);
