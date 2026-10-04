import React from 'react';
import { Tag } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useAllServicemen, useInvalidateReference } from '@/hooks/useReferenceData';
import { LoadError } from '@/components/Shared/LoadError';
import { ServicemanList } from '../ServicemanList';
import styles from './ReceptionistsTab.module.scss';

interface Props {
  isMobile: boolean;
}

/** Мастера приёмщики — сотрудники с включённым свитчем в карточке; здесь выбирают приёмщика по умолчанию */
export const ReceptionistsTab: React.FC<Props> = ({ isMobile }) => {
  const { data: allServicemen = [], isLoading, isError, error, refetch } = useAllServicemen();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const receptionists = allServicemen.filter(s => s.isReceptionist && !s.isDismissed);

  const handleSetDefault = async (id: string) => {
    try {
      await servicesApi.setDefaultReceptionist(id);
      notify.toast.success('Мастер приёмщик по умолчанию установлен');
      await invalidate('servicemen');
    } catch (e) {
      notify.error(e, 'Не удалось изменить приёмщика по умолчанию');
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <Tag color="blue" className={styles.hint}>
          Мастером приёмщиком назначают свитчем в карточке сотрудника (вкладка «Сотрудники»).
          Отмеченный по умолчанию подставляется в новые записи
        </Tag>
      </div>
      {isError && <LoadError title="Не удалось загрузить сотрудников" error={error} onRetry={() => refetch()} />}
      <ServicemanList
        list={receptionists}
        mode="receptionists"
        isMobile={isMobile}
        loading={isLoading}
        onSetDefault={handleSetDefault}
      />
    </div>
  );
};
