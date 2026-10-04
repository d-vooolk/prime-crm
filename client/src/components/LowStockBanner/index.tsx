import React, { useState } from 'react';
import { Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/authStore';
import { useStockLowCount } from '@/hooks/useStock';
import { isManagerOrAbove } from '@/utils/roles';
import styles from './LowStockBanner.module.scss';

// Закрытое напоминание не показываем до конца дня
const DISMISS_KEY = 'prime-crm-low-stock-dismissed';

/** Напоминание в расписании: на складе заканчиваются товары. Видят менеджеры и выше */
export const LowStockBanner: React.FC = () => {
  const { user } = useAuthStore();
  const allowed = isManagerOrAbove(user);
  const { data: count = 0 } = useStockLowCount(allowed);
  const navigate = useNavigate();
  const today = dayjs().format('YYYY-MM-DD');
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === today);

  if (!allowed || count === 0 || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, today);
    setDismissed(true);
  };

  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={dismiss}
      className={styles.banner}
      message={`На складе заканчивается: ${count} ${plural(count)}`}
      action={(
        <Button size="small" onClick={() => navigate('/settings?tab=directory&sub=stock')}>
          Открыть склад
        </Button>
      )}
    />
  );
};

function plural(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позиция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
  return 'позиций';
}
