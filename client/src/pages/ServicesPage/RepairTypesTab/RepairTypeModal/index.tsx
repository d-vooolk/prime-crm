import React, { useEffect, useState } from 'react';
import { Button, Divider, Form, Image, Input, Modal, Popconfirm, Typography, Upload } from 'antd';
import { DeleteOutlined, MinusCircleOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { servicesApi, RepairTypePayload } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { RepairType, RepairTypeFaqItem, RepairTypeLink } from '@/types';
import styles from './RepairTypeModal.module.scss';

interface Props {
  open: boolean;
  /** Редактируемый тип; без него — создание */
  repairType?: RepairType;
  /** Тип создан — окно остаётся открытым уже на нём, чтобы добавить фото */
  onCreated: (id: string) => void;
  onClose: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  faq?: RepairTypeFaqItem[];
  links?: RepairTypeLink[];
}

const URL_RULE = { pattern: /^https?:\/\/\S+$/i, message: 'Ссылка должна начинаться с http:// или https://' };

export const RepairTypeModal: React.FC<Props> = ({ open, repairType, onCreated, onClose }) => {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const repairTypeId = repairType?.id;

  // Форма заполняется при открытии и при переходе с «нового» на созданный тип — не при каждом
  // обновлении списка (после загрузки фото), иначе затрутся несохранённые правки
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (repairType) {
      form.setFieldsValue({
        name: repairType.name,
        description: repairType.description,
        faq: repairType.faq,
        links: repairType.links,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repairTypeId, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload: RepairTypePayload = {
      name: values.name,
      description: values.description ?? '',
      faq: values.faq ?? [],
      links: values.links ?? [],
    };
    setSaving(true);
    try {
      if (repairType) {
        await servicesApi.updateRepairType(repairType.id, payload);
        notify.toast.success('Сохранено');
        await invalidate('repairTypes');
        onClose();
      } else {
        const created = await servicesApi.createRepairType(payload);
        notify.toast.success('Тип создан — теперь можно добавить фото');
        await invalidate('repairTypes');
        onCreated(created.id);
      }
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!repairType) return;
    setUploading(n => n + 1);
    try {
      await servicesApi.uploadRepairTypePhoto(repairType.id, file);
      await invalidate('repairTypes');
    } catch (e) {
      notify.error(e, `Не удалось загрузить ${file.name}`);
    } finally {
      setUploading(n => n - 1);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!repairType) return;
    try {
      await servicesApi.deleteRepairTypePhoto(repairType.id, photoId);
      await invalidate('repairTypes');
    } catch (e) {
      notify.error(e, 'Не удалось удалить фото');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText={repairType ? 'Сохранить' : 'Создать'}
      okButtonProps={{ loading: saving }}
      title={repairType ? repairType.name : 'Новый тип ремонта'}
      width={680}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Название (заголовок блока на странице)" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input placeholder="Например: Замена линз в фарах" maxLength={100} />
        </Form.Item>
        <Form.Item
          label="Краткое описание предстоящей работы"
          name="description"
          extra="Пустая строка — новый абзац"
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={5000} />
        </Form.Item>

        <Divider orientation="left" className={styles.divider}>Фото работы</Divider>
        {repairType ? (
          <>
            <div className={styles.photos}>
              <Image.PreviewGroup>
                {repairType.photos.map(p => (
                  <div key={p.id} className={styles.photo}>
                    <Image src={p.url} width={104} height={78} className={styles.photoImg} />
                    <Popconfirm title="Удалить фото?" onConfirm={() => deletePhoto(p.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} className={styles.photoDelete} />
                    </Popconfirm>
                  </div>
                ))}
              </Image.PreviewGroup>
            </div>
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={file => { void uploadPhoto(file); return false; }}
            >
              <Button icon={<UploadOutlined />} loading={uploading > 0}>Добавить фото</Button>
            </Upload>
            <Typography.Paragraph type="secondary" className={styles.note}>
              Фото сжимаются для телефонов автоматически. Листаются свайпом в том порядке, в каком загружены.
            </Typography.Paragraph>
          </>
        ) : (
          <Typography.Paragraph type="secondary">Фото можно добавить после создания типа.</Typography.Paragraph>
        )}

        <Divider orientation="left" className={styles.divider}>Вопросы и ответы</Divider>
        <Form.List name="faq">
          {(fields, { add, remove }) => (
            <>
              {fields.map(field => (
                <div key={field.key} className={styles.listItem}>
                  <div className={styles.listFields}>
                    <Form.Item name={[field.name, 'question']} rules={[{ required: true, message: 'Укажите вопрос' }]} className={styles.compact}>
                      <Input placeholder="Вопрос" maxLength={300} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'answer']} rules={[{ required: true, message: 'Укажите ответ' }]} className={styles.compact}>
                      <Input.TextArea placeholder="Ответ" autoSize={{ minRows: 2, maxRows: 6 }} maxLength={3000} />
                    </Form.Item>
                  </div>
                  <MinusCircleOutlined className={styles.remove} onClick={() => remove(field.name)} />
                </div>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ question: '', answer: '' })}>
                Добавить вопрос
              </Button>
            </>
          )}
        </Form.List>

        <Divider orientation="left" className={styles.divider}>Ссылки</Divider>
        <Form.List name="links">
          {(fields, { add, remove }) => (
            <>
              {fields.map(field => (
                <div key={field.key} className={styles.listItem}>
                  <div className={styles.linkFields}>
                    <Form.Item name={[field.name, 'title']} rules={[{ required: true, message: 'Текст кнопки' }]} className={styles.compact}>
                      <Input placeholder="Текст кнопки" maxLength={100} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'url']} rules={[{ required: true, message: 'Укажите ссылку' }, URL_RULE]} className={styles.compact}>
                      <Input placeholder="https://prime-auto.by/..." maxLength={500} />
                    </Form.Item>
                  </div>
                  <MinusCircleOutlined className={styles.remove} onClick={() => remove(field.name)} />
                </div>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ title: '', url: 'https://prime-auto.by/' })}>
                Добавить ссылку
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};
