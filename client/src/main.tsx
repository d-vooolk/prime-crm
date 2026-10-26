import { createRoot } from 'react-dom/client';
import '@/styles/global.scss';
import App from './App';
import { registerServiceWorker } from '@/pwa';
import { useUiStore } from '@/store/uiStore';
import { applyUiScale } from '@/utils/uiScale';
import { installImagePreviewSwipe } from '@/utils/imagePreviewSwipe';

// Масштаб — до первой отрисовки, чтобы интерфейс не прыгал. Окно перенесли на другой
// монитор — «Авто» пересчитывается по его ширине
applyUiScale(useUiStore.getState().uiScale);
window.addEventListener('resize', () => applyUiScale(useUiStore.getState().uiScale));

// Просмотр фото: свайп вверх/вниз закрывает, влево/вправо листает
installImagePreviewSwipe();

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);

// Установка на телефон, офлайн-оболочка и пуш-уведомления (только в продакшен-сборке)
registerServiceWorker();
