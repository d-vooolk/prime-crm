import React from 'react';
import { Card } from 'antd';
import cn from 'classnames';
import { CarOutlined } from '@ant-design/icons';
import { Car } from '@/types';
import styles from './ClientCars.module.scss';

interface Props {
  cars: Car[];
  isSelected: (car: Car) => boolean;
  onSelect: (car: Car) => void;
}

/** Автомобили найденного клиента — выбор в один клик */
export const ClientCars: React.FC<Props> = ({ cars, isSelected, onSelect }) => (
  <div className={styles.list}>
    {cars.map(car => (
      <Card
        key={car.id}
        size="small"
        hoverable
        onClick={() => onSelect(car)}
        className={cn(styles.card, { [styles.selected]: isSelected(car) })}
      >
        <div className={styles.row}>
          <CarOutlined className={styles.icon} />
          <div>
            <div className={styles.name}>{car.brand} {car.model}</div>
            <div className={styles.year}>{car.year}</div>
          </div>
        </div>
      </Card>
    ))}
  </div>
);
