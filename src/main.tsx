import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const view = new URLSearchParams(location.search).get('view');
const StagePage = lazy(() => import('./stage/StagePage'));
const Dashboard = lazy(() => import('./dashboard/Dashboard'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{view === 'stage' || view === 'preview' ? <StagePage preview={view === 'preview'} /> : <Dashboard />}</Suspense>
  </StrictMode>
);
