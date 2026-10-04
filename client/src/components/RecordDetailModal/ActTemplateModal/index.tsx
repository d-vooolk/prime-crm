import React from 'react';
import { Button, Modal, Radio, Tag } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import type { ActTemplateChoice } from '../useRecordPrint';
import styles from './ActTemplateModal.module.scss';

interface Props {
  choice: ActTemplateChoice | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onPrint: () => void;
}

/** Выбор шаблона акта, когда в записи услуги из разных категорий */
export const ActTemplateModal: React.FC<Props> = ({ choice, onSelect, onCancel, onPrint }) => (
  <Modal
    open={!!choice}
    onCancel={onCancel}
    title="Выбор шаблона акта"
    footer={[
      <Button key="cancel" onClick={onCancel}>Отмена</Button>,
      <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={onPrint}>
        Печатать
      </Button>,
    ]}
    width={480}
  >
    <p className={styles.hint}>
      В записи услуги из разных категорий. Выберите шаблон акта для печати:
    </p>
    <Radio.Group
      value={choice?.selectedId}
      onChange={e => onSelect(e.target.value)}
      className={styles.options}
    >
      {choice?.templates.map(t => (
        <Radio key={t.id} value={t.id}>
          {t.name}
          {t.isDefault && !t.categoryId && (
            <Tag color="blue" className={styles.tag}>по умолчанию</Tag>
          )}
          {t.category && <Tag className={styles.tag}>{t.category.name}</Tag>}
        </Radio>
      ))}
    </Radio.Group>
  </Modal>
);
