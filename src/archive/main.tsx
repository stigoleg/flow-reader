import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Archive from './Archive';
import { ToastProvider } from '@/reader/components/Toast';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ToastProvider>
        <Archive />
      </ToastProvider>
    </StrictMode>
  );
}
