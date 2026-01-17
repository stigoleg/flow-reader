import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Archive from './Archive';
import { ToastProvider } from '@/reader/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Archive />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
