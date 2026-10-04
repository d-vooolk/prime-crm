import { createRoot } from 'react-dom/client';
import '@/styles/global.scss';
import App from './App';
import { registerServiceWorker } from '@/pwa';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);

// Установка на телефон, офлайн-оболочка и пуш-уведомления (только в продакшен-сборке)
registerServiceWorker();
