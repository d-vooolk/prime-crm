import React, { useState } from 'react';
import cn from 'classnames';
import { Button, Popconfirm } from 'antd';
import { BookOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wikiApi } from '@/api/wiki.api';
import { WikiKey, WikiReworkItem } from '@/types';
import { useWikiStore } from '@/store/wikiStore';
import { useNotify } from '@/hooks/useNotify';
import { plural } from '@/utils/formatters';
import { ReviewNotes } from './WikiReviewTab';
import styles from './WikiPage.module.scss';

interface Props {
  selected: WikiKey;
  sectionId?: string;
  onSelect: (key: WikiKey, sectionId?: string) => void;
}

const carTitle = (r: WikiReworkItem) =>
  [r.entry.markName, r.entry.modelName, r.entry.generationName].filter(Boolean).join(' ');

/**
 * Правки сотрудника, которые проверяющий вернул на доработку: замечание, переход в раздел
 * и «Отправить на проверку», когда всё исправлено. Пока правка на доработке, все изменения
 * автора в этом разделе копятся в ней и к проверяющему не уходят.
 */
export const WikiReworkBanner: React.FC<Props> = ({ selected, sectionId, onSelect }) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const refreshPendingCount = useWikiStore(s => s.refreshPendingCount);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: items = [] } = useQuery({
    queryKey: ['wiki-rework'],
    queryFn: wikiApi.getRework,
    meta: { silent: true },
  });
  if (items.length === 0) return null;

  const isSelected = (r: WikiReworkItem) =>
    r.entry.markId === selected.markId && r.entry.modelId === selected.modelId
    && r.entry.generationId === selected.generationId && (r.sectionId ?? undefined) === sectionId;

  const open = (r: WikiReworkItem) => onSelect(
    { markId: r.entry.markId, modelId: r.entry.modelId, generationId: r.entry.generationId },
    r.sectionId ?? undefined,
  );

  const resubmit = async (r: WikiReworkItem) => {
    setBusyId(r.id);
    try {
      await wikiApi.resubmit(r.id);
      notify.success('Отправлено на проверку');
      await queryClient.invalidateQueries({ queryKey: ['wiki-rework'] });
      void refreshPendingCount();
    } catch (e) {
      notify.error(e, 'Не удалось отправить на проверку');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={styles.rework}>
      <div className={styles.missedHead}>
        <span className={cn(styles.missedIcon, styles.reworkIcon)}><EditOutlined /></span>
        <div>
          <div className={cn(styles.missedKicker, styles.reworkKicker)}>На доработку</div>
          <div className={styles.missedTitle}>
            {`Исправьте ${items.length} ${plural(items.length, ['раздел', 'раздела', 'разделов'])} по замечаниям и отправьте на проверку`}
          </div>
        </div>
      </div>
      <div className={styles.reworkList}>
        {items.map(r => (
          <div key={r.id} className={cn(styles.reworkItem, { [styles.reworkItemActive]: isSelected(r) })}>
            <div className={styles.revisionCar}>
              {carTitle(r)}
              <span className={styles.missedChipSection}> · {r.sectionName ?? 'Общее'}</span>
            </div>
            <ReviewNotes notes={r.reviewNotes} />
            <div className={styles.reworkActions}>
              {!isSelected(r) && (
                <Button icon={<BookOutlined />} onClick={() => open(r)}>Открыть раздел</Button>
              )}
              <Popconfirm
                title="Отправить на проверку?"
                description="Проверьте, что исправили всё по замечанию"
                okText="Отправить"
                cancelText="Отмена"
                onConfirm={() => resubmit(r)}
              >
                <Button type="primary" icon={<SendOutlined />} loading={busyId === r.id}>Отправить на проверку</Button>
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
