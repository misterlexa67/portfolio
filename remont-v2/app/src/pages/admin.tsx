import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/controls.css';
import '../sections/chrome/chrome.css';
import { IsoDefs } from '../components/iso/materials';
import { ToastProvider } from '../components/ui';
import { AdminApp } from '../admin/AdminApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <IsoDefs />
      <AdminApp />
    </ToastProvider>
  </StrictMode>,
);
