import React, { useMemo, useState } from 'react';
import { App, Badge, Button, Dropdown, Empty, Grid, Input, Popconfirm, Segmented, Space, Spin, Table, Tag, Tooltip, Tree } from 'antd';
import {
  DeleteOutlined, EditOutlined, FolderAddOutlined, HistoryOutlined, MinusOutlined, MoreOutlined,
  PlusOutlined, SearchOutlined, WarningOutlined,
} from '@ant-design/icons';
import { stockApi } from '@/api/stock.api';
import { useInvalidateStock, useStockCategories, useStockItems } from '@/hooks/useStock';
import { useNotify } from '@/hooks/useNotify';
import { LoadError } from '@/components/Shared/LoadError';
import type { StockCategory, StockItem, StockMovementType } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { buildStockTree, canHoldChildren, canHoldItems, categoryPath, formatQty, lowCountDeep, StockTreeNode } from './stock.utils';
import { StockCategoryModal } from './StockCategoryModal';
import { StockItemModal } from './StockItemModal';
import { StockMovementModal } from './StockMovementModal';
import { StockHistoryModal } from './StockHistoryModal';
import styles from './StockTab.module.scss';

type View = 'category' | 'low';

/**
 * Склад: дерево категорий слева, товары выбранной конечной категории справа.
 * Поиск ищет по всему складу, «Заканчивается» — товары на пороге напоминания и ниже.
 */
export const StockTab: React.FC = () => {
  const isMobile = !Grid.useBreakpoint().md;
  const notify = useNotify();
  const { modal } = App.useApp();
  const invalidate = useInvalidateStock();
  const { data: categories = [], isLoading, isError, error, refetch } = useStockCategories();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('category');
  const [search, setSearch] = useState('');
  const q = search.trim();

  const selected = categories.find(c => c.id === selectedId) ?? null;
  const itemsParams = q ? { q } : view === 'low' ? { low: true } : { categoryId: canHoldItems(selected) ? selected!.id : undefined };
  const items = useStockItems(itemsParams);

  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: StockCategory | null; parent?: { id: string; path: string } | null }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: StockItem | null }>({ open: false });
  const [movement, setMovement] = useState<{ item: StockItem | null; type?: StockMovementType }>({ item: null });
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  const tree = useMemo(() => buildStockTree(categories), [categories]);
  const totalLow = categories.reduce((s, c) => s + c.lowStockCount, 0);

  const deleteCategory = async (c: StockCategory) => {
    try {
      await stockApi.deleteCategory(c.id);
      if (selectedId === c.id) setSelectedId(c.parentId);
      invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось удалить категорию');
    }
  };

  const deleteItem = async (item: StockItem) => {
    try {
      await stockApi.deleteItem(item.id);
      invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось удалить товар');
    }
  };

  const renderNode = (node: StockTreeNode) => {
    const c = node.category;
    const low = lowCountDeep(categories, c.id);
    return (
      <span className={styles.node}>
        <span className={styles.nodeName}>{c.name}</span>
        {c.itemsCount > 0 && <span className={styles.nodeCount}>{c.itemsCount}</span>}
        {low > 0 && <Badge count={low} size="small" color="var(--color-warning)" />}
      </span>
    );
  };

  if (isError) return <LoadError title="Не удалось загрузить склад" error={error} onRetry={() => refetch()} />;

  const selectedPath = selected ? categoryPath(categories, selected.id) : '';

  const categoryActions = selected && (
    <Space wrap size={4}>
      {canHoldChildren(selected) && (
        <Button size="small" icon={<FolderAddOutlined />} onClick={() => setCategoryModal({ open: true, parent: { id: selected.id, path: selectedPath } })}>
          Подкатегория
        </Button>
      )}
      <Button size="small" icon={<EditOutlined />} onClick={() => setCategoryModal({ open: true, category: selected })}>
        Переименовать
      </Button>
      <Popconfirm
        title="Удалить категорию?"
        description="Удалить можно только пустую категорию"
        okText="Удалить"
        cancelText="Отмена"
        onConfirm={() => deleteCategory(selected)}
      >
        <Button size="small" danger icon={<DeleteOutlined />}>Удалить</Button>
      </Popconfirm>
    </Space>
  );

  const itemMenu = (item: StockItem) => ({
    items: [
      { key: 'adjust', label: 'Инвентаризация', onClick: () => setMovement({ item, type: 'ADJUST' }) },
      { key: 'history', label: 'История движений', icon: <HistoryOutlined />, onClick: () => setHistoryItem(item) },
      { key: 'edit', label: 'Изменить', icon: <EditOutlined />, onClick: () => setItemModal({ open: true, item }) },
      { type: 'divider' as const },
      {
        key: 'delete', label: 'Удалить', danger: true, icon: <DeleteOutlined />,
        onClick: () => modal.confirm({
          title: `Удалить «${item.name}»?`,
          content: 'Товар пропадёт со склада, история движений сохранится',
          okText: 'Удалить',
          okButtonProps: { danger: true },
          cancelText: 'Отмена',
          onOk: () => deleteItem(item),
        }),
      },
    ],
  });

  const showItems = !!q || view === 'low' || canHoldItems(selected);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>Категории</span>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCategoryModal({ open: true, parent: null })}>
            Категория
          </Button>
        </div>
        {isLoading ? (
          <div className={styles.center}><Spin /></div>
        ) : tree.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Создайте первую категорию" />
        ) : (
          <Tree<StockTreeNode>
            treeData={tree}
            titleRender={renderNode}
            selectedKeys={selectedId ? [selectedId] : []}
            onSelect={keys => { setSelectedId((keys[0] as string) ?? null); setView('category'); setSearch(''); }}
            defaultExpandAll
            blockNode
            className={styles.tree}
            height={isMobile ? undefined : 520}
          />
        )}
      </aside>

      <section className={styles.content}>
        <div className={styles.toolbar}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Поиск по названию, артикулу, заметке"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.search}
          />
          <Segmented<View>
            value={q ? 'category' : view}
            onChange={v => { setView(v); setSearch(''); }}
            options={[
              { value: 'category', label: 'По категории' },
              {
                value: 'low',
                label: <span>Заканчивается {totalLow > 0 && <Badge count={totalLow} size="small" color="var(--color-warning)" />}</span>,
              },
            ]}
          />
        </div>

        {!q && view === 'category' && selected && (
          <div className={styles.categoryHead}>
            <span className={styles.categoryPath}>{selectedPath}</span>
            {categoryActions}
          </div>
        )}

        {!showItems ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={selected
              ? 'В этой категории есть подкатегории — товары лежат в конечных категориях'
              : 'Выберите категорию слева или найдите товар поиском'}
          />
        ) : (
          <>
            {!q && view === 'category' && selected && (
              <Button icon={<PlusOutlined />} type="dashed" onClick={() => setItemModal({ open: true })} className={styles.addItem}>
                Добавить товар
              </Button>
            )}
            {items.isError ? (
              <LoadError error={items.error} onRetry={() => items.refetch()} />
            ) : (
              <Table<StockItem>
                dataSource={items.data ?? []}
                rowKey="id"
                size="small"
                loading={items.isFetching}
                pagination={(items.data?.length ?? 0) > 50 ? { pageSize: 50, size: 'small' } : false}
                scroll={{ x: 640 }}
                rowClassName={item => (item.isLow ? styles.lowRow : '')}
                locale={{ emptyText: view === 'low' && !q ? 'Всё в наличии' : 'Товаров нет' }}
                columns={[
                  {
                    title: 'Товар', key: 'name',
                    render: (_, item) => (
                      <div>
                        <div className={styles.itemName}>
                          {item.name}
                          {item.sku && <span className={styles.sku}>{item.sku}</span>}
                        </div>
                        {(q || view === 'low') && <div className={styles.itemPath}>{item.categoryPath}</div>}
                        {item.notes && <div className={styles.itemNotes}>{item.notes}</div>}
                      </div>
                    ),
                  },
                  {
                    title: 'Остаток', key: 'qty', width: 150,
                    render: (_, item) => (
                      <span className={item.isLow ? styles.qtyLow : styles.qty}>
                        {item.isLow && (
                          <Tooltip title={`Порог напоминания: ${formatQty(item.minQuantity ?? 0)} ${item.unit}`}>
                            <WarningOutlined />{' '}
                          </Tooltip>
                        )}
                        {formatQty(item.quantity)} {item.unit}
                      </span>
                    ),
                  },
                  {
                    title: 'Порог', key: 'min', width: 90,
                    render: (_, item) => (item.minQuantity != null ? `${formatQty(item.minQuantity)}` : <Tag>нет</Tag>),
                  },
                  {
                    title: 'Закупка', key: 'price', width: 100,
                    render: (_, item) => (item.purchasePrice != null ? formatPrice(item.purchasePrice) : '—'),
                  },
                  {
                    title: '', key: 'actions', width: 150, fixed: 'right',
                    render: (_, item) => (
                      <Space size={4}>
                        <Tooltip title="Приход">
                          <Button size="small" icon={<PlusOutlined />} onClick={() => setMovement({ item, type: 'IN' })} />
                        </Tooltip>
                        <Tooltip title="Расход">
                          <Button size="small" icon={<MinusOutlined />} onClick={() => setMovement({ item, type: 'OUT' })} />
                        </Tooltip>
                        <Dropdown menu={itemMenu(item)} trigger={['click']}>
                          <Button size="small" icon={<MoreOutlined />} aria-label="Ещё" />
                        </Dropdown>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </section>

      <StockCategoryModal
        open={categoryModal.open}
        category={categoryModal.category}
        parent={categoryModal.parent}
        onClose={() => setCategoryModal({ open: false })}
        onSaved={invalidate}
      />
      <StockItemModal
        open={itemModal.open}
        item={itemModal.item}
        categoryId={selected?.id ?? null}
        categoryPath={itemModal.item?.categoryPath ?? selectedPath}
        onClose={() => setItemModal({ open: false })}
        onSaved={invalidate}
      />
      <StockMovementModal
        item={movement.item}
        initialType={movement.type}
        onClose={() => setMovement({ item: null })}
        onSaved={invalidate}
      />
      <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
    </div>
  );
};
