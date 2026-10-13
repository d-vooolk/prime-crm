import React, { useState } from 'react';
import { Button, Checkbox, Empty, Image, Segmented, Spin, Tag } from 'antd';
import { CalendarOutlined, PhoneOutlined } from '@ant-design/icons';
import cn from 'classnames';
import dayjs from 'dayjs';
import { SiteLead, siteLeadsApi } from '@/api/siteLeads.api';
import { recordsApi } from '@/api/records.api';
import { useInvalidateSiteLeads, useSiteLeads, useSiteLeadsNewCount } from '@/hooks/useSiteLeads';
import { useNotify } from '@/hooks/useNotify';
import { LoadError } from '@/components/Shared/LoadError';
import { RecordModal } from '@/components/RecordModal';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { Record as CrmRecord } from '@/types';
import { formatDateTime } from '@/utils/formatters';
import { telHref, toCrmPhone } from './leads.utils';
import styles from './LeadsPage.module.scss';

type Tab = 'new' | 'handled';

/**
 * Заявки из формы сайта prime-auto.by (менеджер и выше). «Выполнено» — заявка обработана
 * без записи; «Записать» — окно новой записи с именем и телефоном, фото заявки уходят в запись
 */
export const LeadsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('new');
  const notify = useNotify();
  const invalidate = useInvalidateSiteLeads();
  const { data: leads = [], isLoading, isError, error, refetch } = useSiteLeads(tab);
  const { data: newCount = 0 } = useSiteLeadsNewCount();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recordingLead, setRecordingLead] = useState<SiteLead | null>(null);
  const [openedRecord, setOpenedRecord] = useState<CrmRecord | null>(null);

  const toggleDone = async (lead: SiteLead, done: boolean) => {
    setBusyId(lead.id);
    try {
      await siteLeadsApi.setDone(lead.id, done);
      notify.toast.success(done ? 'Заявка выполнена' : 'Заявка возвращена в новые');
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось отметить заявку');
    } finally {
      setBusyId(null);
    }
  };

  // Запись уже сохранена — привязываем её к заявке (и переносим фото)
  const handleRecordCreated = async (lead: SiteLead, record: CrmRecord) => {
    try {
      await siteLeadsApi.attachRecord(lead.id, record.id);
      if (lead.photoUrls.length) notify.toast.success('Фото из заявки добавлены в запись');
    } catch (e) {
      notify.error(e, 'Запись создана, но заявка не отмечена');
    } finally {
      await invalidate();
    }
  };

  const openRecord = async (recordId: string) => {
    try {
      setOpenedRecord(await recordsApi.getById(recordId));
    } catch (e) {
      notify.error(e, 'Не удалось открыть запись');
    }
  };

  const renderStatus = (lead: SiteLead) => {
    if (lead.status === 'NEW') return null;
    const who = [lead.handledByName, lead.handledAt && formatDateTime(lead.handledAt)].filter(Boolean).join(', ');
    return (
      <div className={styles.handled}>
        {lead.status === 'RECORDED'
          ? <Tag color="success">Записан</Tag>
          : <Tag>Выполнено</Tag>}
        {who && <span className={styles.muted}>{who}</span>}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Заявки с сайта</h1>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'new', label: newCount > 0 ? `Новые · ${newCount}` : 'Новые' },
            { value: 'handled', label: 'Обработанные' },
          ]}
        />
      </div>

      {isError && <LoadError title="Не удалось загрузить заявки" error={error} onRetry={() => refetch()} />}

      {isLoading ? (
        <div className={styles.loader}><Spin /></div>
      ) : leads.length === 0 && !isError ? (
        <Empty
          className={styles.empty}
          description={tab === 'new' ? 'Новых заявок нет — все разобраны' : 'Обработанных заявок пока нет'}
        />
      ) : (
        <div className={styles.list}>
          {leads.map(lead => (
            <article key={lead.id} className={cn(styles.card, { [styles.cardNew]: lead.status === 'NEW' })}>
              <div className={styles.cardTop}>
                <span className={styles.name}>{lead.name}</span>
                <span className={styles.muted}>{formatDateTime(lead.createdAt)}</span>
              </div>

              <a className={styles.phone} href={telHref(lead.phone)}>
                <PhoneOutlined /> {lead.phone}
              </a>

              {lead.message && <p className={styles.message}>{lead.message}</p>}

              {lead.photoUrls.length > 0 && (
                <Image.PreviewGroup>
                  <div className={styles.photos}>
                    {lead.photoUrls.map((url, i) => (
                      <Image key={url} src={url} alt={`Фото ${i + 1}`} width={88} height={88} className={styles.photo} />
                    ))}
                  </div>
                </Image.PreviewGroup>
              )}

              {(lead.page || lead.source) && (
                <div className={styles.meta}>
                  {lead.page && <div>Страница: {lead.page}</div>}
                  {lead.source && <div>Откуда: {lead.source}</div>}
                </div>
              )}

              {renderStatus(lead)}

              <div className={styles.actions}>
                {lead.status !== 'RECORDED' && (
                  <Checkbox
                    checked={lead.status === 'DONE'}
                    disabled={busyId === lead.id}
                    onChange={e => toggleDone(lead, e.target.checked)}
                  >
                    Выполнено
                  </Checkbox>
                )}
                {lead.status === 'NEW' && (
                  <Button type="primary" icon={<CalendarOutlined />} onClick={() => setRecordingLead(lead)}>
                    Записать
                  </Button>
                )}
                {lead.status === 'RECORDED' && lead.recordId && (
                  <Button onClick={() => openRecord(lead.recordId!)}>Открыть запись</Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <RecordModal
        open={!!recordingLead}
        onClose={() => setRecordingLead(null)}
        onSuccess={() => undefined}
        initialDate={dayjs().format('YYYY-MM-DD')}
        initialClient={recordingLead ? { name: recordingLead.name, phone: toCrmPhone(recordingLead.phone) } : undefined}
        onCreated={record => { if (recordingLead) void handleRecordCreated(recordingLead, record); }}
      />

      <RecordDetailModal
        record={openedRecord}
        open={!!openedRecord}
        onClose={() => setOpenedRecord(null)}
        onRefresh={() => { if (openedRecord) void openRecord(openedRecord.id); }}
      />
    </div>
  );
};
