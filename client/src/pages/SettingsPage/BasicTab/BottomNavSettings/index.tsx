import React from 'react';
import { Button, Checkbox } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { useNavPrefsStore } from '@/store/navPrefsStore';
import { NAV_ITEMS } from '@/components/SideBar/navItems';
import { canSeePath } from '@/utils/roles';
import { BOTTOM_NAV_MAX, bottomNavPaths } from '@/utils/bottomNav';
import styles from './BottomNavSettings.module.scss';

/**
 * Какие разделы стоят в нижней панели телефона (до пяти), остальные — в «Ещё».
 * Свой набор у каждого пользователя; хранится на этом устройстве
 */
export const BottomNavSettings: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const chosen = useNavPrefsStore(s => (user ? s.bottomNav[user.id] : undefined));
  const setBottomNav = useNavPrefsStore(s => s.setBottomNav);
  if (!user) return null;

  const items = NAV_ITEMS.filter(item => canSeePath(user, item.path));
  const selected = bottomNavPaths(items.map(i => i.path), chosen);
  const full = selected.length >= BOTTOM_NAV_MAX;

  const toggle = (path: string, on: boolean) => {
    const next = on ? [...selected, path] : selected.filter(p => p !== path);
    setBottomNav(user.id, next);
  };

  return (
    <div className={styles.block}>
      <div className={styles.head}>
        <div>
          <div className={styles.label}>Нижняя панель</div>
          <div className={styles.hint}>
            До {BOTTOM_NAV_MAX} разделов, остальные — в <AppstoreOutlined /> «Ещё». Выбрано {selected.length} из {BOTTOM_NAV_MAX}
          </div>
        </div>
        {chosen && (
          <Button size="small" type="link" onClick={() => setBottomNav(user.id, null)}>По умолчанию</Button>
        )}
      </div>
      <div className={styles.list}>
        {items.map(item => {
          const checked = selected.includes(item.path);
          return (
            <Checkbox
              key={item.path}
              className={styles.item}
              checked={checked}
              // Хотя бы один раздел в панели; больше пяти не помещается
              disabled={checked ? selected.length === 1 : full}
              onChange={e => toggle(item.path, e.target.checked)}
            >
              <span className={styles.itemIcon}>{item.icon}</span>
              {item.label}
            </Checkbox>
          );
        })}
      </div>
    </div>
  );
};
