import React from 'react';
import { Button, Popconfirm, Tooltip } from 'antd';
import {
  PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, ReloadOutlined, CalendarOutlined, CarOutlined, StarOutlined,
} from '@ant-design/icons';
import type { Record } from '@/types';
import styles from './RecordDetailFooter.module.scss';

export type SmsKind = 'CAR_READY' | 'REVIEW_REQUEST';

interface Props {
  record: Record;
  isMobile: boolean;
  isEmployee: boolean;
  canDelete: boolean;
  smsSending: SmsKind | null;
  printing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onCloseDeal: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSendSms: (type: SmsKind) => void;
  onPrintWorkOrder: () => void;
  onPrintAct: () => void;
  onPrintContract: () => void;
  onPrintInvoice: () => void;
}

/** Кнопки карточки записи: на телефоне — в несколько рядов, на десктопе — в одну строку */
export const RecordDetailFooter: React.FC<Props> = ({
  record: r, isMobile, isEmployee, canDelete, smsSending, printing,
  onEdit, onCancel, onCloseDeal, onRestore, onDelete, onSendSms,
  onPrintWorkOrder, onPrintAct, onPrintContract, onPrintInvoice,
}) => {
  const editable = r.status === 'ACTIVE' || r.status === 'CLOSED';

  const deleteConfirm = (button: React.ReactNode) => (
    <Popconfirm
      title="Удалить запись?"
      description="Запись и все связанные данные будут удалены безвозвратно."
      onConfirm={onDelete}
      okText="Удалить"
      okButtonProps={{ danger: true }}
      cancelText="Отмена"
    >
      {button}
    </Popconfirm>
  );

  // На десктопе у иконок SMS есть подсказка, на телефоне она мешает нажатию
  const smsButtons = (withTooltip: boolean) => {
    const carReady = <Button icon={<CarOutlined />} loading={smsSending === 'CAR_READY'} />;
    const review = <Button icon={<StarOutlined />} loading={smsSending === 'REVIEW_REQUEST'} />;
    return (
      <>
        <Popconfirm
          title="Отправить SMS «Авто готово»?"
          description={`На номер ${r.client.phone}`}
          onConfirm={() => onSendSms('CAR_READY')}
          okText="Отправить" cancelText="Отмена"
        >
          {withTooltip ? <Tooltip title="Авто готово">{carReady}</Tooltip> : carReady}
        </Popconfirm>
        <Popconfirm
          title="Отправить запрос отзыва?"
          description={`На номер ${r.client.phone}`}
          onConfirm={() => onSendSms('REVIEW_REQUEST')}
          okText="Отправить" cancelText="Отмена"
        >
          {withTooltip ? <Tooltip title="Запросить отзыв">{review}</Tooltip> : review}
        </Popconfirm>
      </>
    );
  };

  if (isMobile) {
    return (
      <div className={styles.footerMobile}>
        {editable && !isEmployee && (
          <div className={styles.footerMobileRow}>
            <Button icon={<CalendarOutlined />} onClick={onEdit} className={styles.footerMobileFlex}>
              Редактировать
            </Button>
            {r.status === 'ACTIVE' && (
              <Popconfirm title="Отменить запись?" onConfirm={onCancel} okText="Да" cancelText="Нет">
                <Button danger icon={<CloseCircleOutlined />} className={styles.footerMobileFlex}>
                  Отменить
                </Button>
              </Popconfirm>
            )}
          </div>
        )}
        {r.status === 'ACTIVE' && !isEmployee && (
          <Button type="primary" icon={<CheckCircleOutlined />} block onClick={onCloseDeal}>
            Закрыть сделку
          </Button>
        )}
        {r.status === 'CANCELLED' && !isEmployee && (
          <Popconfirm title="Восстановить запись?" onConfirm={onRestore} okText="Да" cancelText="Нет">
            <Button type="primary" icon={<ReloadOutlined />} block>Восстановить</Button>
          </Popconfirm>
        )}
        {/* SMS иконки + Заявка + Удалить */}
        {!isEmployee && (
          <div className={styles.footerMobileRow}>
            {editable && smsButtons(false)}
            <Button
              icon={<PrinterOutlined />}
              loading={printing}
              onClick={r.isLegalEntity ? onPrintContract : onPrintWorkOrder}
              className={styles.footerMobileFlex}
            >
              {r.isLegalEntity ? 'Договор' : 'Заявка'}
            </Button>
            {canDelete && deleteConfirm(
              <Button danger icon={<DeleteOutlined />} className={styles.footerMobileFlex}>Удалить</Button>,
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.footer}>
      <div className={styles.footerDelete}>
        {canDelete && deleteConfirm(<Button danger icon={<DeleteOutlined />}>Удалить</Button>)}
      </div>
      {!isEmployee && (
        <div className={styles.footerSecondary}>
          {editable && smsButtons(true)}
          {r.isLegalEntity ? (
            <>
              <Button icon={<PrinterOutlined />} loading={printing} onClick={onPrintContract}>Договор</Button>
              <Button icon={<PrinterOutlined />} loading={printing} onClick={onPrintInvoice}>Счёт</Button>
              <Button icon={<PrinterOutlined />} loading={printing} onClick={onPrintAct}>Акт</Button>
            </>
          ) : (
            <>
              <Button icon={<PrinterOutlined />} loading={printing} onClick={onPrintWorkOrder}>Заявка</Button>
              {r.deal && (
                <Button icon={<PrinterOutlined />} loading={printing} onClick={onPrintAct}>Акт</Button>
              )}
            </>
          )}
        </div>
      )}
      {!isEmployee && (
        <div className={styles.footerPrimary}>
          {editable && (
            <Button icon={<CalendarOutlined />} onClick={onEdit}>Редактировать</Button>
          )}
          {r.status === 'ACTIVE' && (
            <>
              <Popconfirm title="Отменить запись?" onConfirm={onCancel} okText="Да" cancelText="Нет">
                <Button danger icon={<CloseCircleOutlined />}>Отменить</Button>
              </Popconfirm>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={onCloseDeal}>
                Закрыть сделку
              </Button>
            </>
          )}
          {r.status === 'CANCELLED' && (
            <Popconfirm title="Восстановить запись?" onConfirm={onRestore} okText="Да" cancelText="Нет">
              <Button type="primary" icon={<ReloadOutlined />}>Восстановить</Button>
            </Popconfirm>
          )}
        </div>
      )}
    </div>
  );
};
