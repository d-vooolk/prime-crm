import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal } from 'antd';
import { CatalogItemInput } from '@/api/cars.api';
import { CarGeneration } from '@/types';
import { AnyItem, LEVEL_LABELS, Level } from '../catalog';
import styles from './CatalogItemModal.module.scss';

export interface CatalogEditorTarget {
  level: Level;
  /** null — добавление новой записи */
  item: AnyItem | null;
}

interface Props {
  target: CatalogEditorTarget | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: CatalogItemInput) => void;
}

const NAME_PLACEHOLDERS: Record<Level, string> = {
  mark: 'Например: КамАЗ',
  model: 'Например: 5490',
  generation: 'Например: I поколение',
};

/** Добавление/правка ручной записи справочника авто */
export const CatalogItemModal: React.FC<Props> = ({ target, saving, onCancel, onSubmit }) => {
  const [form] = Form.useForm<CatalogItemInput>();
  // Отдельным стейтом, чтобы предпросмотр перерисовывался по мере ввода ссылки
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

  useEffect(() => {
    if (!target) {
      form.resetFields();
      setPhotoPreview(null);
      setPhotoBroken(false);
      return;
    }
    const { level, item } = target;
    const photo = level === 'generation' ? (item as CarGeneration | null)?.photo ?? null : null;
    form.setFieldsValue({
      name: item?.name ?? '',
      yearFrom: item?.year_from ?? null,
      yearTo: item?.year_to ?? null,
      photo,
    });
    setPhotoPreview(photo);
  }, [target, form]);

  return (
    <Modal
      open={!!target}
      title={target ? `${target.item ? 'Изменить' : 'Добавить'} ${LEVEL_LABELS[target.level].one}` : ''}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={target?.item ? 'Сохранить' : 'Добавить'}
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
      width={420}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className={styles.form}>
        <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input autoFocus placeholder={target ? NAME_PLACEHOLDERS[target.level] : undefined} />
        </Form.Item>

        <div className={styles.yearRow}>
          <Form.Item label="Год начала" name="yearFrom">
            <InputNumber min={1900} max={2100} precision={0} placeholder="не важно" className={styles.fullWidth} />
          </Form.Item>
          <Form.Item label="Год окончания" name="yearTo">
            <InputNumber min={1900} max={2100} precision={0} placeholder="выпускается" className={styles.fullWidth} />
          </Form.Item>
        </div>

        <div className={styles.formHint}>
          Годы указывать не обязательно. Если заполните — в карточке записи год авто
          можно будет выбрать из этого диапазона.
        </div>

        {target?.level === 'generation' && (
          <>
            <Form.Item
              label="Ссылка на фото"
              name="photo"
              className={styles.photoField}
              rules={[{
                validator: (_, value?: string) => {
                  const url = value?.trim();
                  if (!url) return Promise.resolve();
                  return /^https?:\/\/\S+$/i.test(url)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Ссылка должна начинаться с http:// или https://'));
                },
              }]}
            >
              <Input
                allowClear
                placeholder="https://example.com/truck.jpg"
                onChange={e => {
                  setPhotoPreview(e.target.value.trim() || null);
                  setPhotoBroken(false);
                }}
              />
            </Form.Item>

            <div className={styles.photoBox}>
              {photoPreview && !photoBroken ? (
                <img
                  src={photoPreview}
                  alt="Предпросмотр"
                  className={styles.photoPreview}
                  onError={() => setPhotoBroken(true)}
                />
              ) : (
                <div className={styles.photoEmpty}>
                  {photoBroken ? 'Картинка не загрузилась — проверьте ссылку' : 'Фото не задано'}
                </div>
              )}
            </div>

            <div className={styles.formHint}>
              Это фото показывается на карточке записи и при выборе авто.
              Нужна прямая ссылка на картинку, а не на страницу с ней.
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};
