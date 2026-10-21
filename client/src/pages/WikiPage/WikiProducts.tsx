import React, { useMemo, useState } from 'react';
import { Button, Popconfirm } from 'antd';
import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { wikiApi } from '@/api/wiki.api';
import { VdfCatalogProduct, WikiEntry, WikiKey } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { ProductThumb, WikiProductPicker } from './WikiProductPicker';
import styles from './WikiPage.module.scss';

interface Props {
  carKey: WikiKey;
  /** Раздел карточки; null — «Общее» */
  sectionId: string | null;
  entry: WikiEntry | null;
  setEntry: React.Dispatch<React.SetStateAction<WikiEntry | null>>;
  onChanged: () => void;
}

/** Товары vdf.by в разделе карточки: ссылки на сайт и выбор из каталога */
export const WikiProducts: React.FC<Props> = ({ carKey, sectionId, entry, setEntry, onChanged }) => {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const products = useMemo(
    () => entry?.products.filter(p => (p.sectionId ?? null) === sectionId) ?? [],
    [entry, sectionId],
  );
  const attached = useMemo(() => new Set(products.map(p => p.productId)), [products]);

  const add = async (product: VdfCatalogProduct) => {
    try {
      const saved = await wikiApi.addProduct(carKey, sectionId, product.id);
      setEntry(prev => (prev && saved && prev.id === saved.id ? { ...prev, products: saved.products } : saved));
      notify.toast.success('Товар прикреплён');
      onChanged();
    } catch (e) {
      notify.error(e, 'Не удалось прикрепить товар');
    }
  };

  const remove = async (id: string) => {
    try {
      await wikiApi.removeProduct(id);
      setEntry(prev => (prev ? { ...prev, products: prev.products.filter(p => p.id !== id) } : prev));
    } catch (e) {
      notify.error(e);
    }
  };

  return (
    <>
      <div className={styles.mediaHeader}>
        <span className={styles.mediaTitle}>Товары vdf.by · {products.length}</span>
        <Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>Добавить товар</Button>
      </div>

      {products.length > 0 && (
        <ul className={styles.productList}>
          {products.map(p => (
            <li key={p.id} className={styles.productRow}>
              <ProductThumb src={p.imageUrl} />
              <a className={styles.productLink} href={p.url} target="_blank" rel="noreferrer">
                {p.title}
                <LinkOutlined className={styles.productLinkIcon} />
              </a>
              <Popconfirm
                title="Открепить товар?"
                okText="Открепить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
                onConfirm={() => remove(p.id)}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </li>
          ))}
        </ul>
      )}

      <WikiProductPicker open={open} attached={attached} onPick={add} onClose={() => setOpen(false)} />
    </>
  );
};
