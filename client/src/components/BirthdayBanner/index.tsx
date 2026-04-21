import React, { useEffect, useState } from 'react';
import { servicesApi } from '@/api/services.api';
import styles from './BirthdayBanner.module.scss';

interface BirthdayPerson {
  id: string;
  name: string;
  position?: string;
  birthday: string;
}

export const BirthdayBanner: React.FC = () => {
  const [people, setPeople] = useState<BirthdayPerson[]>([]);

  useEffect(() => {
    servicesApi.getTodayBirthdays().then(setPeople).catch(() => {});
  }, []);

  if (people.length === 0) return null;

  const names = people.map(p => p.name).join(', ');
  const text = people.length === 1
    ? `Сегодня день рождения у ${names}!`
    : `Сегодня день рождения у ${names}!`;

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>🎂</span>
      <span className={styles.text}>{text}</span>
    </div>
  );
};
