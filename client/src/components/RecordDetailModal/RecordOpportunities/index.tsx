import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Divider, Skeleton } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { recordsApi } from '@/api/records.api';
import type { Record } from '@/types';
import { formatPrice } from '@/utils/formatters';
import styles from './RecordOpportunities.module.scss';

interface Props {
  record: Record;
}

const plural = (n: number, forms: [string, string, string]) => {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
};

/**
 * «Открытые возможности» (BETA) — что предложить клиенту дополнительно. Сервер смотрит прошлые
 * визиты такого же авто и берёт работы, которые делали попутно (не причину визита) и не дороже
 * текущего заказа. Видят только менеджер, директор и создатель.
 */
export const RecordOpportunities: React.FC<Props> = ({ record: r }) => {
  // Состав работ меняется при редактировании записи — пересчитываем
  const itemsKey = r.items.map(i => i.serviceId).sort().join(',');
  const { data, isPending, isError } = useQuery({
    queryKey: ['record-opportunities', r.id, itemsKey],
    queryFn: () => recordsApi.getOpportunities(r.id),
    meta: { silent: true },
  });

  if (isError) return null;

  const carLabel = data?.scope === 'generation'
    ? `${r.car.brand} ${r.car.model}${r.car.generationName ? ` ${r.car.generationName}` : ''}`
    : `${r.car.brand} ${r.car.model}`;

  return (
    <>
      <Divider orientation="left" className={styles.divider}>
        <span className={styles.title}>
          Открытые возможности <span className={styles.beta}>BETA</span>
        </span>
      </Divider>
      {isPending ? (
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      ) : !data || data.items.length === 0 ? (
        <div className={styles.empty}>
          {data && data.basedOn > 0
            ? `По ${data.basedOn} ${plural(data.basedOn, ['визиту', 'визитам', 'визитам'])} ${carLabel} предложить пока нечего`
            : 'Похожих визитов ещё не было — предложить пока нечего'}
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {data.items.map(o => (
              <li key={o.serviceId} className={styles.item}>
                <span className={styles.icon}><BulbOutlined /></span>
                <div className={styles.body}>
                  <div className={styles.name}>{o.name}</div>
                  <div className={styles.reason}>
                    Делали попутно {o.count} {plural(o.count, ['раз', 'раза', 'раз'])}
                    {o.togetherWith.length > 0 && <> · вместе с: {o.togetherWith.join(', ')}</>}
                  </div>
                </div>
                <span className={styles.price}>≈ {formatPrice(o.price)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.footnote}>
            По {data.basedOn} {plural(data.basedOn, ['закрытому визиту', 'закрытым визитам', 'закрытым визитам'])} {carLabel}.
            Предлагаются только попутные работы и не дороже текущего заказа
          </div>
        </>
      )}
    </>
  );
};
