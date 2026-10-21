import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Modal, Popconfirm, Spin } from 'antd';
import {
  CheckOutlined, DeleteOutlined, LinkOutlined, PlusOutlined, SearchOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import cn from 'classnames';
import { wikiApi } from '@/api/wiki.api';
import { VdfCatalogCategory, VdfCatalogProduct, WikiEntry, WikiKey } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { formatMoney } from '@/utils/formatters';
import { useDebounced } from '../ClientsPage/useClientsFilter';
import styles from './WikiPage.module.scss';

interface Props {
  carKey: WikiKey;
  /** Раздел карточки; null — «Общее» */
  sectionId: string | null;
  entry: WikiEntry | null;
  setEntry: React.Dispatch<React.SetStateAction<WikiEntry | null>>;
  onChanged: () => void;
}

const CATALOG_STALE_MS = 5 * 60_000;
const MIN_QUERY = 2;

const Thumb: React.FC<{ src: string | null }> = ({ src }) => (
  src
    ? <img className={styles.productThumb} src={src} alt="" loading="lazy" />
    : <span className={cn(styles.productThumb, styles.productThumbEmpty)}><ShoppingOutlined /></span>
);

interface PickerProps {
  open: boolean;
  attached: Set<string>;
  onPick: (product: VdfCatalogProduct) => Promise<void>;
  onClose: () => void;
}

/** Поиск по каталогу vdf.by, без запроса — разделы: сначала верхние, у выбранного — подразделы */
const ProductPicker: React.FC<PickerProps> = ({ open, attached, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [rootId, setRootId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const debounced = useDebounced(query.trim(), 300);
  const searching = debounced.length >= MIN_QUERY;
  const categoryId = childId ?? rootId;

  const categories = useQuery({
    queryKey: ['vdf-catalog', 'categories'],
    queryFn: wikiApi.getCatalogCategories,
    enabled: open,
    staleTime: CATALOG_STALE_MS,
  });

  const list = useQuery({
    queryKey: ['vdf-catalog', searching ? 'search' : 'category', searching ? debounced : categoryId],
    queryFn: () => (searching ? wikiApi.searchCatalog(debounced) : wikiApi.getCatalogCategory(categoryId!)),
    enabled: open && (searching || !!categoryId),
    staleTime: CATALOG_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const roots = useMemo(() => (categories.data ?? []).filter(c => !c.parentId), [categories.data]);
  const children = useMemo(
    () => (categories.data ?? []).filter(c => rootId && c.parentId === rootId),
    [categories.data, rootId],
  );

  const pickRoot = (id: string) => {
    setRootId(current => (current === id ? null : id));
    setChildId(null);
  };

  const pick = async (product: VdfCatalogProduct) => {
    if (attached.has(product.id) || adding) return;
    setAdding(product.id);
    try {
      await onPick(product);
    } finally {
      setAdding(null);
    }
  };

  const chip = (c: VdfCatalogCategory, active: boolean, onClick: () => void, small = false) => (
    <button
      key={c.id}
      type="button"
      className={cn(styles.catalogChip, { [styles.catalogChipActive]: active, [styles.catalogChipSmall]: small })}
      onClick={onClick}
    >
      {c.name}
      <span className={styles.catalogChipCount}>{c.count}</span>
    </button>
  );

  const showList = searching || !!categoryId;
  const items = showList ? list.data?.items ?? [] : [];
  const total = showList ? list.data?.total ?? 0 : 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Товар из каталога vdf.by"
      footer={<Button type="primary" onClick={onClose}>Готово</Button>}
      width={680}
      destroyOnHidden
    >
      <Input
        autoFocus
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder="Название, артикул, цоколь…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {!searching && (
        <div className={styles.catalogCategories}>
          {categories.isLoading && <Spin size="small" />}
          {categories.isError && <span className={styles.catalogHint}>Не удалось загрузить разделы магазина</span>}
          <div className={styles.catalogChips}>
            {roots.map(c => chip(c, rootId === c.id, () => pickRoot(c.id)))}
          </div>
          {children.length > 0 && (
            <div className={cn(styles.catalogChips, styles.catalogChipsSub)}>
              {children.map(c => chip(c, childId === c.id, () => setChildId(id => (id === c.id ? null : c.id)), true))}
            </div>
          )}
        </div>
      )}

      <div className={styles.catalogList}>
        {!showList && (
          <div className={styles.catalogHint}>
            {query.trim().length === 1 ? 'Ещё хотя бы одна буква' : 'Начните вводить название или выберите раздел'}
          </div>
        )}
        {showList && list.isLoading && <div className={styles.catalogHint}><Spin /></div>}
        {showList && list.isError && <div className={styles.catalogHint}>Магазин не ответил, попробуйте ещё раз</div>}
        {showList && list.isSuccess && items.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searching ? 'Ничего не нашлось' : 'В разделе пусто'} />
        )}
        {items.map(p => {
          const isAttached = attached.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={cn(styles.catalogItem, { [styles.catalogItemAttached]: isAttached })}
              onClick={() => pick(p)}
              disabled={isAttached}
            >
              <Thumb src={p.image} />
              <span className={styles.catalogItemText}>
                <span className={styles.catalogItemTitle}>{p.title}</span>
                <span className={styles.catalogItemMeta}>
                  {p.category} · от {formatMoney(p.price)}
                  {!p.inStock && <span className={styles.catalogOut}> · нет в наличии</span>}
                </span>
              </span>
              <span className={styles.catalogItemAction}>
                {isAttached ? <CheckOutlined /> : adding === p.id ? <Spin size="small" /> : <PlusOutlined />}
              </span>
            </button>
          );
        })}
        {total > items.length && (
          <div className={styles.catalogHint}>
            Показаны {items.length} из {total} — уточните запрос
          </div>
        )}
      </div>
    </Modal>
  );
};

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
              <Thumb src={p.imageUrl} />
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

      <ProductPicker open={open} attached={attached} onPick={add} onClose={() => setOpen(false)} />
    </>
  );
};
