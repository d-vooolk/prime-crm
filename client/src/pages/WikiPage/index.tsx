import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Badge, Card, Form, InputNumber, Button } from 'antd';
import { wikiApi } from '@/api/wiki.api';
import { WikiKey } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useWikiStore, isWikiReviewer } from '@/store/wikiStore';
import { useNotify } from '@/hooks/useNotify';
import { WikiCarsTab } from './WikiCarsTab';
import { WikiReviewTab } from './WikiReviewTab';
import styles from './WikiPage.module.scss';

/**
 * Wiki по автомобилям. Выбранный автомобиль и вкладка живут в адресе
 * (?mark=&model=&generation=&tab=) — так на карточку ведёт кнопка из записи.
 */
export const WikiPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const reviewer = isWikiReviewer(user);
  const pendingCount = useWikiStore(s => s.pendingCount);
  const notify = useNotify();
  const [bonusAmount, setBonusAmount] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm] = Form.useForm<{ bonusAmount: number }>();

  const tab = reviewer ? (params.get('tab') || 'cars') : 'cars';
  const markId = params.get('mark') || '';
  const modelId = params.get('model') || '';
  const generationId = params.get('generation') || '';

  useEffect(() => {
    if (!reviewer) return;
    wikiApi.getSettings().then(s => setBonusAmount(s.bonusAmount)).catch(() => {});
  }, [reviewer]);

  const selectCar = (key: Partial<WikiKey>) => {
    const next = new URLSearchParams();
    if (key.markId) next.set('mark', key.markId);
    if (key.modelId) next.set('model', key.modelId);
    if (key.generationId) next.set('generation', key.generationId);
    setParams(next, { replace: true });
  };

  const setTab = (key: string) => {
    const next = new URLSearchParams(params);
    if (key === 'cars') next.delete('tab'); else next.set('tab', key);
    setParams(next, { replace: true });
  };

  const saveSettings = async () => {
    const values = await settingsForm.validateFields().catch(() => null);
    if (!values) return;
    setSavingSettings(true);
    try {
      const saved = await wikiApi.updateSettings({ bonusAmount: values.bonusAmount ?? 0 });
      setBonusAmount(saved.bonusAmount);
      notify.success('Настройки вики сохранены');
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const carsTab = (
    <WikiCarsTab markId={markId} modelId={modelId} generationId={generationId} onSelect={selectCar} />
  );

  const items = [
    { key: 'cars', label: 'Автомобили', children: carsTab },
    ...(reviewer ? [
      {
        key: 'review',
        label: <Badge count={pendingCount} size="small" offset={[8, -2]}>Проверка правок</Badge>,
        children: <WikiReviewTab bonusAmount={bonusAmount} onOpenCar={selectCar} />,
      },
      {
        key: 'settings',
        label: 'Настройки',
        children: (
          <Card title="Премия за заполнение вики">
            <Form
              key={bonusAmount}
              form={settingsForm}
              layout="vertical"
              className={styles.settingsForm}
              initialValues={{ bonusAmount }}
            >
              <Form.Item
                label="Фиксированный размер премии, р."
                name="bonusAmount"
                extra="Назначается кнопкой во вкладке «Проверка правок» и попадает в расчёт ЗП сотрудника."
                rules={[{ required: true, message: 'Укажите сумму' }]}
              >
                <InputNumber min={0} step={5} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" loading={savingSettings} onClick={saveSettings}>Сохранить</Button>
            </Form>
          </Card>
        ),
      },
    ] : []),
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Wiki</h1>
      <Tabs activeKey={tab} onChange={setTab} items={items} destroyOnHidden />
    </div>
  );
};
