import React, { useState } from 'react';
import { Button, Collapse } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useAuthStore } from '@/store/authStore';
import { useNotify } from '@/hooks/useNotify';
import { useAllServicemen, useInvalidateReference } from '@/hooks/useReferenceData';
import { Serviceman } from '@/types';
import { canEditServicemanRole, getAssignableRoles } from '@/utils/roles';
import { LoadError } from '@/components/Shared/LoadError';
import { ServicemanList } from '../ServicemanList';
import { ServicemanModal } from '../ServicemanModal';
import styles from './EmployeesTab.module.scss';

interface Props {
  isMobile: boolean;
}

/** Все профили сотрудников: активные, уволенные и карточка сотрудника */
export const EmployeesTab: React.FC<Props> = ({ isMobile }) => {
  const { user } = useAuthStore();
  const { data: allServicemen = [], isLoading, isError, error, refetch } = useAllServicemen();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [modal, setModal] = useState<{ open: boolean; item?: Serviceman }>({ open: false });

  const canEdit = (row: Serviceman) => canEditServicemanRole(user, row.role);
  const active = allServicemen.filter(s => !s.isDismissed);
  const dismissed = allServicemen.filter(s => s.isDismissed);

  const handleDismiss = async (id: string) => {
    try {
      await servicesApi.dismissServiceman(id);
      notify.toast.success('Сотрудник уволен');
      await invalidate('servicemen');
    } catch (e) {
      notify.error(e, 'Не удалось уволить сотрудника');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await servicesApi.restoreServiceman(id);
      notify.toast.success('Сотрудник восстановлен');
      await invalidate('servicemen');
    } catch (e) {
      notify.error(e, 'Не удалось восстановить сотрудника');
    }
  };

  const listProps = {
    isMobile,
    canEdit,
    onEdit: (row: Serviceman) => setModal({ open: true, item: row }),
    onDismiss: handleDismiss,
    onRestore: handleRestore,
  };

  return (
    <div>
      <div className={styles.tabActions}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true })}>
          Добавить сотрудника
        </Button>
      </div>
      {isError && <LoadError title="Не удалось загрузить сотрудников" error={error} onRetry={() => refetch()} />}
      <ServicemanList {...listProps} list={active} mode="employees" loading={isLoading} />
      {dismissed.length > 0 && (
        <Collapse
          className={styles.dismissed}
          items={[{
            key: 'dismissed',
            label: `Уволенные (${dismissed.length})`,
            children: <ServicemanList {...listProps} list={dismissed} mode="dismissed" />,
          }]}
        />
      )}

      <ServicemanModal
        open={modal.open}
        item={modal.item}
        allowedRoles={getAssignableRoles(user)}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
};
