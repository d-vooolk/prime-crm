import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Modal, Spin } from 'antd';
import {
  ArrowLeftOutlined, CaretDownOutlined, CaretRightOutlined, CheckOutlined, PlusOutlined, SearchOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import cn from 'classnames';
import { wikiApi } from '@/api/wiki.api';
import { VdfCatalogCategory, VdfCatalogList, VdfCatalogProduct, VdfFrameType } from '@/types';
import { formatMoney, plural } from '@/utils/formatters';
import { useDebounced } from '../ClientsPage/useClientsFilter';
import styles from './WikiPage.module.scss';

const CATALOG_STALE_MS = 5 * 60_000;
const MIN_QUERY = 2;

/** Где пользователь в каталоге: дерево разделов → раздел, а у переходных рамок — тип → машины */
type View =
  | { kind: 'tree' }
  | { kind: 'category'; category: VdfCatalogCategory }
  | { kind: 'frameTypes'; category: VdfCatalogCategory }
  | { kind: 'frameType'; category: VdfCatalogCategory; type: string };

export const ProductThumb: React.FC<{ src: string | null }> = ({ src }) => (
  src
    ? <img className={styles.productThumb} src={src} alt="" loading="lazy" />
    : <span className={cn(styles.productThumb, styles.productThumbEmpty)}><ShoppingOutlined /></span>
);

interface ProductRowsProps {
  items: VdfCatalogProduct[];
  attached: Set<string>;
  adding: string | null;
  onPick: (product: VdfCatalogProduct) => void;
  /** Рамки одного типа: вместо названия товара — машина */
  carTitles?: boolean;
}

const ProductRows: React.FC<ProductRowsProps> = ({ items, attached, adding, onPick, carTitles }) => (
  <>
    {items.map(p => {
      const isAttached = attached.has(p.id);
      return (
        <button
          key={p.id}
          type="button"
          className={cn(styles.catalogItem, { [styles.catalogItemAttached]: isAttached })}
          onClick={() => onPick(p)}
          disabled={isAttached}
        >
          <ProductThumb src={p.image} />
          <span className={styles.catalogItemText}>
            <span className={styles.catalogItemTitle}>{carTitles && p.car ? p.car : p.title}</span>
            <span className={styles.catalogItemMeta}>
              {!carTitles && `${p.category} · `}от {formatMoney(p.price)}
              {!p.inStock && <span className={styles.catalogOut}> · нет в наличии</span>}
            </span>
          </span>
          <span className={styles.catalogItemAction}>
            {isAttached ? <CheckOutlined /> : adding === p.id ? <Spin size="small" /> : <PlusOutlined />}
          </span>
        </button>
      );
    })}
  </>
);

/** Список товаров постранично: поиск или раздел, «Показать ещё» догружает следующую страницу */
function usePagedProducts(key: unknown[], fetchPage: (offset: number) => Promise<VdfCatalogList>, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ['vdf-catalog', ...key],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total && last.items.length > 0 ? loaded : undefined;
    },
    enabled,
    staleTime: CATALOG_STALE_MS,
  });
  const items = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  return { query, items, total };
}

interface PagedListProps {
  paged: ReturnType<typeof usePagedProducts>;
  emptyText: string;
  rows: (items: VdfCatalogProduct[]) => React.ReactNode;
}

const PagedList: React.FC<PagedListProps> = ({ paged, emptyText, rows }) => {
  const { query, items, total } = paged;
  if (query.isLoading) return <div className={styles.catalogHint}><Spin /></div>;
  if (query.isError) return <div className={styles.catalogHint}>Магазин не ответил, попробуйте ещё раз</div>;
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  return (
    <>
      {rows(items)}
      {query.hasNextPage && (
        <Button
          className={styles.catalogMore}
          loading={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Показать ещё · {items.length} из {total}
        </Button>
      )}
    </>
  );
};

interface CategoryTreeProps {
  categories: VdfCatalogCategory[];
  onOpen: (category: VdfCatalogCategory) => void;
}

/** Разделы как в админке магазина: у раздела с подразделами — стрелка, по умолчанию свёрнут */
const CategoryTree: React.FC<CategoryTreeProps> = ({ categories, onOpen }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const roots = categories.filter(c => !c.parentId);
  const childrenOf = (id: string) => categories.filter(c => c.parentId === id);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const row = (c: VdfCatalogCategory, level: number, hasChildren: boolean) => (
    <div key={c.id} className={cn(styles.treeRow, { [styles.treeRowChild]: level > 0 })}>
      {hasChildren ? (
        <button
          type="button"
          className={styles.treeToggle}
          onClick={() => toggle(c.id)}
          aria-label={expanded.has(c.id) ? 'Свернуть' : 'Раскрыть'}
          aria-expanded={expanded.has(c.id)}
        >
          {expanded.has(c.id) ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </button>
      ) : (
        <span className={styles.treeToggle} />
      )}
      <button type="button" className={styles.treeName} onClick={() => onOpen(c)} disabled={c.count === 0}>
        <span>{c.name}</span>
        <span className={styles.catalogChipCount}>{c.count}</span>
      </button>
    </div>
  );

  return (
    <div className={styles.tree}>
      {roots.map(root => {
        const children = childrenOf(root.id);
        return (
          <React.Fragment key={root.id}>
            {row(root, 0, children.length > 0)}
            {expanded.has(root.id) && children.map(child => row(child, 1, false))}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface FrameTypeListProps {
  category: VdfCatalogCategory;
  onOpen: (type: string) => void;
}

const FrameTypeList: React.FC<FrameTypeListProps> = ({ category, onOpen }) => {
  const [filter, setFilter] = useState('');
  const types = useQuery({
    queryKey: ['vdf-catalog', 'frame-types', category.id],
    queryFn: () => wikiApi.getFrameTypes(category.id),
    staleTime: CATALOG_STALE_MS,
  });

  const needle = filter.trim().toLowerCase();
  const visible = useMemo(
    () => (types.data ?? []).filter((t: VdfFrameType) => !needle
      || t.type.toLowerCase().includes(needle)
      || t.marks.some(m => m.toLowerCase().includes(needle))),
    [types.data, needle],
  );

  if (types.isLoading) return <div className={styles.catalogHint}><Spin /></div>;
  if (types.isError) return <div className={styles.catalogHint}>Магазин не ответил, попробуйте ещё раз</div>;

  return (
    <>
      <Input
        className={styles.typeFilter}
        allowClear
        size="small"
        placeholder={`Фильтр по типу или марке · ${types.data?.length ?? 0} ${plural(types.data?.length ?? 0, ['тип', 'типа', 'типов'])}`}
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      {visible.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Таких типов нет" />}
      {visible.map(t => (
        <button key={t.type} type="button" className={styles.catalogItem} onClick={() => onOpen(t.type)}>
          <span className={styles.typeCode}>{t.type}</span>
          <span className={styles.catalogItemText}>
            <span className={styles.catalogItemMeta}>
              {t.count} авто · {t.marks.join(', ')}
              {t.count > t.marks.length && '…'}
            </span>
          </span>
          <CaretRightOutlined className={styles.typeArrow} />
        </button>
      ))}
    </>
  );
};

interface PickerProps {
  open: boolean;
  attached: Set<string>;
  onPick: (product: VdfCatalogProduct) => Promise<void>;
  onClose: () => void;
}

/** Выбор товара vdf.by: поиск как на сайте, без запроса — дерево разделов магазина */
export const WikiProductPicker: React.FC<PickerProps> = ({ open, attached, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'tree' });
  const [adding, setAdding] = useState<string | null>(null);
  const debounced = useDebounced(query.trim(), 300);
  const searching = debounced.length >= MIN_QUERY;

  const categories = useQuery({
    queryKey: ['vdf-catalog', 'categories'],
    queryFn: wikiApi.getCatalogCategories,
    enabled: open,
    staleTime: CATALOG_STALE_MS,
  });

  const search = usePagedProducts(
    ['search', debounced],
    offset => wikiApi.searchCatalog(debounced, offset),
    open && searching,
  );
  const categoryId = view.kind === 'category' ? view.category.id : '';
  const categoryList = usePagedProducts(
    ['category', categoryId],
    offset => wikiApi.getCatalogCategory(categoryId, offset),
    open && !searching && view.kind === 'category',
  );
  const frameTypeKey = view.kind === 'frameType' ? [view.category.id, view.type] : ['', ''];
  const frameTypeList = usePagedProducts(
    ['frame-type', ...frameTypeKey],
    () => wikiApi.getFrameTypeProducts(frameTypeKey[0], frameTypeKey[1]),
    open && !searching && view.kind === 'frameType',
  );

  const pick = async (product: VdfCatalogProduct) => {
    if (attached.has(product.id) || adding) return;
    setAdding(product.id);
    try {
      await onPick(product);
    } finally {
      setAdding(null);
    }
  };

  const openCategory = (category: VdfCatalogCategory) =>
    setView(category.frameTypes ? { kind: 'frameTypes', category } : { kind: 'category', category });

  const rows = (carTitles = false) => (items: VdfCatalogProduct[]) => (
    <ProductRows items={items} attached={attached} adding={adding} onPick={pick} carTitles={carTitles} />
  );

  const back = (label: string, to: View, title: string) => (
    <div className={styles.catalogCrumbs}>
      <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => setView(to)}>{label}</Button>
      <span className={styles.catalogCrumbTitle}>{title}</span>
    </div>
  );

  const body = () => {
    if (searching) {
      return <PagedList paged={search} emptyText="Ничего не нашлось" rows={rows()} />;
    }
    switch (view.kind) {
      case 'category':
        return (
          <>
            {back('Разделы', { kind: 'tree' }, view.category.name)}
            <PagedList paged={categoryList} emptyText="В разделе пусто" rows={rows()} />
          </>
        );
      case 'frameTypes':
        return (
          <>
            {back('Разделы', { kind: 'tree' }, `${view.category.name} · выберите тип`)}
            <FrameTypeList category={view.category} onOpen={type => setView({ kind: 'frameType', category: view.category, type })} />
          </>
        );
      case 'frameType':
        return (
          <>
            {back('Типы', { kind: 'frameTypes', category: view.category }, `Тип ${view.type} · выберите авто`)}
            <PagedList paged={frameTypeList} emptyText="У типа нет рамок" rows={rows(true)} />
          </>
        );
      default:
        if (categories.isLoading) return <div className={styles.catalogHint}><Spin /></div>;
        if (categories.isError) return <div className={styles.catalogHint}>Не удалось загрузить разделы магазина</div>;
        return <CategoryTree categories={categories.data ?? []} onOpen={openCategory} />;
    }
  };

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
        placeholder="Поиск по сайту: название, артикул, цоколь…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query.trim().length === 1 && <div className={styles.catalogHint}>Ещё хотя бы одна буква</div>}
      <div className={styles.catalogList}>{body()}</div>
    </Modal>
  );
};
