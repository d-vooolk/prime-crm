import React, { useCallback, useRef, useState } from 'react';
import { Form, Input, AutoComplete, Row, Col, Switch } from 'antd';
import MaskedInput from 'antd-mask-input';
import { clientsApi } from '@/api/clients.api';
import { Client } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { getErrorMessage } from '@/utils/errors';
import { RecordFormData } from '../../types';
import styles from './ClientFields.module.scss';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
  /** Клиента выбрали из подсказок по телефону */
  onSelectClient: (client: Client) => void;
}

/** Телефон с поиском клиента, ФИО, примечание и переключатель «юр. лицо» */
export const ClientFields: React.FC<Props> = ({ data, onChange, onSelectClient }) => {
  const notify = useNotify();
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  // Номер последнего поиска: ответы на устаревшие запросы (печатают быстро) отбрасываем
  const searchSeq = useRef(0);

  const handlePhoneSearch = useCallback(async (phone: string) => {
    onChange({ clientPhone: phone });
    const seq = ++searchSeq.current;
    if (phone.replace(/\D/g, '').length < 7) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await clientsApi.searchByPhone(phone);
      if (seq === searchSeq.current) setSuggestions(results);
    } catch (e) {
      if (seq !== searchSeq.current) return;
      setSuggestions([]);
      // Один key — при наборе номера ошибка не размножится на каждую цифру
      notify.toast.error({ content: `Поиск клиента не удался: ${getErrorMessage(e)}`, key: 'client-phone-search' });
    }
  }, [onChange, notify]);

  const handleSelect = (clientId: string) => {
    const client = suggestions.find(c => c.id === clientId);
    if (client) onSelectClient(client);
  };

  const phoneOptions = suggestions.map(c => ({
    value: c.id,
    label: (
      <div>
        <div className={styles.optionTitle}>{c.name}</div>
        <div className={styles.optionMeta}>
          {c.phone} · {c.cars?.map(car => `${car.brand} ${car.model}`).join(', ')}
        </div>
      </div>
    ),
  }));

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Телефон" required>
            <AutoComplete
              value={data.clientPhone}
              options={phoneOptions}
              onSelect={handleSelect}
              onSearch={handlePhoneSearch}
              className={styles.fullWidth}
            >
              <MaskedInput
                mask="+375 (00) 000-00-00"
                value={data.clientPhone}
                inputMode="tel"
                placeholder="+375 (29) 000-00-00"
              />
            </AutoComplete>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={data.isLegalEntity ? 'ФИО представителя' : 'ФИО клиента'} required>
            <Input
              value={data.clientName}
              onChange={e => onChange({ clientName: e.target.value })}
              placeholder="Иванов Иван Иванович"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Примечание (только для вас)">
            <Input.TextArea
              value={data.clientNotes}
              onChange={e => onChange({ clientNotes: e.target.value })}
              rows={2}
              placeholder="Внутреннее примечание, не будет в документах"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} className={styles.legalSwitch}>
          <Switch
            checked={!!data.isLegalEntity}
            onChange={v => onChange({ isLegalEntity: v })}
          />
          <span className={styles.legalSwitchLabel}>Юридическое лицо</span>
        </Col>
      </Row>
    </>
  );
};
