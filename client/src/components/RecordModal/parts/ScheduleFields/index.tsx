import React, { useEffect } from 'react';
import { Form, Select, DatePicker, Row, Col } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { Serviceman } from '@/types';
import { useServicemen } from '@/hooks/useReferenceData';
import { RecordFormData } from '../../types';
import { CLIENT_SOURCE_OPTIONS } from '@/utils/clientSource';
import styles from './ScheduleFields.module.scss';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

const EMPTY_SERVICEMEN: Serviceman[] = [];

// Рабочие часы 09–19, минуты шагом 5
const HOUR_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 9).map(h => ({ value: h, label: String(h).padStart(2, '0') }));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5).map(m => ({ value: m, label: String(m).padStart(2, '0') }));

/** Дата и время записи, исполнитель, мастер приёмщик и источник клиента */
export const ScheduleFields: React.FC<Props> = ({ data, onChange }) => {
  const { data: servicemen = EMPTY_SERVICEMEN } = useServicemen();

  // Мастер приёмщик по умолчанию — когда сотрудники загрузились, а в записи он не выбран
  useEffect(() => {
    if (!data.receptionist) {
      const def = servicemen.find(s => s.isReceptionist && s.isDefault && !s.isDismissed);
      if (def) onChange({ receptionist: def.name });
    }
  }, [servicemen]); // eslint-disable-line react-hooks/exhaustive-deps

  const employees = servicemen.filter(s => s.isPerformer && !s.isDismissed);
  const receptionists = servicemen.filter(s => s.isReceptionist && !s.isDismissed);

  const [hour, minute] = data.time ? data.time.split(':') : [];

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Дата" required>
            <DatePicker
              className={styles.fullWidth}
              value={data.date ? dayjs(data.date) : null}
              onChange={d => onChange({ date: d?.toISOString() || '' })}
              format="DD.MM.YYYY"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Время" required>
            <div className={styles.time}>
              <Select
                value={hour !== undefined ? Number(hour) : undefined}
                onChange={h => onChange({ time: `${String(h).padStart(2, '0')}:${minute ?? '00'}` })}
                placeholder="ЧЧ"
                className={styles.timePart}
                options={HOUR_OPTIONS}
              />
              <Select
                value={minute !== undefined ? Number(minute) : undefined}
                onChange={m => onChange({ time: `${hour ?? '09'}:${String(m).padStart(2, '0')}` })}
                placeholder="ММ"
                className={styles.timePart}
                options={MINUTE_OPTIONS}
              />
            </div>
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Сотрудник">
            <Select
              value={data.serviceman || undefined}
              onChange={v => onChange({ serviceman: v ?? '' })}
              placeholder="Выберите сотрудника"
              allowClear
              options={employees.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Мастер приёмщик">
            <Select
              value={data.receptionist || undefined}
              onChange={v => onChange({ receptionist: v ?? '' })}
              placeholder="Выберите мастера"
              allowClear
              options={receptionists.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          {/* Для статистики каналов привлечения на дашборде */}
          <Form.Item label="Источник клиента">
            <Select
              value={data.clientSource ?? undefined}
              onChange={v => onChange({ clientSource: v ?? null })}
              placeholder="Откуда узнал о нас"
              allowClear
              options={CLIENT_SOURCE_OPTIONS}
            />
          </Form.Item>
        </Col>
        {data.isLegalEntity && (
          <Col xs={24} sm={8}>
            <Form.Item label="Дата окончания работ">
              <DatePicker
                className={styles.fullWidth}
                value={data.legalEndDate ? dayjs(data.legalEndDate) : null}
                onChange={(d: Dayjs | null) => onChange({ legalEndDate: d?.toISOString() || '' })}
                format="DD.MM.YYYY"
              />
            </Form.Item>
          </Col>
        )}
      </Row>
    </>
  );
};
