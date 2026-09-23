import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Form, Select, Input, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { carsApi } from '@/api/cars.api';
import { wikiApi } from '@/api/wiki.api';
import { CarBrand, CarModel, CarGeneration, WikiEntrySummary, WikiKey } from '@/types';
import { WikiCarCard } from './WikiCarCard';
import styles from './WikiPage.module.scss';

interface Props {
  markId: string;
  modelId: string;
  generationId: string;
  onSelect: (key: Partial<WikiKey>) => void;
}

const generationLabel = (g: CarGeneration) =>
  (g.year_from ? `${g.name} (${g.year_from}–${g.year_to || 'н.в.'})` : g.name);

const entryKey = (k: WikiKey) => `${k.markId}/${k.modelId}/${k.generationId}`;

export const WikiCarsTab: React.FC<Props> = ({ markId, modelId, generationId, onSelect }) => {
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);
  const [entries, setEntries] = useState<WikiEntrySummary[]>([]);
  const [search, setSearch] = useState('');

  const loadEntries = () => wikiApi.getEntries().then(setEntries).catch(() => {});

  useEffect(() => {
    carsApi.getBrands().then(setBrands).catch(() => {});
    loadEntries();
  }, []);

  useEffect(() => {
    setModels([]);
    if (!markId) return;
    setLoadingModels(true);
    carsApi.getModels(markId).then(setModels).catch(() => {}).finally(() => setLoadingModels(false));
  }, [markId]);

  useEffect(() => {
    setGenerations([]);
    if (!markId || !modelId) return;
    setLoadingGenerations(true);
    carsApi.getGenerations(markId, modelId)
      .then(setGenerations).catch(() => {}).finally(() => setLoadingGenerations(false));
  }, [markId, modelId]);

  const filledKeys = useMemo(() => new Set(entries.map(entryKey)), [entries]);
  const filledModels = useMemo(() => new Set(entries.map(e => `${e.markId}/${e.modelId}`)), [entries]);
  const filledMarks = useMemo(() => new Set(entries.map(e => e.markId)), [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      `${e.markName} ${e.modelName} ${e.generationName ?? ''}`.toLowerCase().includes(q));
  }, [entries, search]);

  const brand = brands.find(b => b.id === markId);
  const model = models.find(m => m.id === modelId);
  const generation = generations.find(g => g.id === generationId);
  const isSelected = !!(markId && modelId && generationId);
  // Пока справочник грузится, берём подпись из списка заполненных — карточка из ссылки открывается сразу
  const knownEntry = entries.find(e => entryKey(e) === `${markId}/${modelId}/${generationId}`);
  const title = [
    brand?.name ?? knownEntry?.markName,
    model?.name ?? knownEntry?.modelName,
    generation ? generationLabel(generation) : knownEntry?.generationName,
  ].filter(Boolean).join(' ');

  const filledMark = <span className={styles.hasWikiMark}>● wiki</span>;

  return (
    <div className={styles.section}>
      <Card>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Марка">
                <Select
                  showSearch
                  value={markId || undefined}
                  placeholder="Выберите марку"
                  optionFilterProp="label"
                  onChange={v => onSelect({ markId: v, modelId: '', generationId: '' })}
                  options={brands.map(b => ({ value: b.id, label: b.name }))}
                  optionRender={({ data }) => {
                    const b = brands.find(x => x.id === data.value);
                    return (
                      <span className={styles.selectOption}>
                        {b?.logo && <img className={styles.brandLogo} src={`https://${b.logo}`} alt="" />}
                        {data.label}
                        {filledMarks.has(String(data.value)) && filledMark}
                      </span>
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Модель">
                <Select
                  showSearch
                  value={modelId || undefined}
                  placeholder="Выберите модель"
                  disabled={!markId}
                  loading={loadingModels}
                  optionFilterProp="label"
                  onChange={v => onSelect({ markId, modelId: v, generationId: '' })}
                  options={models.map(m => ({ value: m.id, label: m.name }))}
                  optionRender={({ data }) => (
                    <span>
                      {data.label}
                      {filledModels.has(`${markId}/${data.value}`) && filledMark}
                    </span>
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Поколение">
                <Select
                  showSearch
                  value={generationId || undefined}
                  placeholder="Выберите поколение"
                  disabled={!modelId}
                  loading={loadingGenerations}
                  optionFilterProp="label"
                  onChange={v => onSelect({ markId, modelId, generationId: v })}
                  options={generations.map(g => ({ value: g.id, label: generationLabel(g) }))}
                  optionRender={({ data }) => (
                    <span>
                      {data.label}
                      {filledKeys.has(`${markId}/${modelId}/${data.value}`) && filledMark}
                    </span>
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {isSelected && (
        <WikiCarCard
          key={`${markId}/${modelId}/${generationId}`}
          carKey={{ markId, modelId, generationId }}
          title={title}
          onChanged={loadEntries}
        />
      )}

      <Card title={`Заполненные карточки (${entries.length})`}>
        <Input
          className={styles.entriesSearch}
          prefix={<SearchOutlined />}
          placeholder="Поиск по марке, модели, поколению"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Table
          dataSource={filteredEntries}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          rowClassName={() => styles.entryRow}
          onRow={row => ({
            onClick: () => {
              onSelect({ markId: row.markId, modelId: row.modelId, generationId: row.generationId });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            },
          })}
          locale={{ emptyText: 'Ничего не найдено' }}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Автомобиль',
              key: 'car',
              render: (_: unknown, e: WikiEntrySummary) => `${e.markName} ${e.modelName} ${e.generationName ?? ''}`,
            },
            {
              title: 'Фото/видео',
              dataIndex: 'mediaCount',
              key: 'media',
              width: 110,
              responsive: ['sm'],
            },
            {
              title: 'Обновлено',
              key: 'updated',
              width: 200,
              responsive: ['md'],
              render: (_: unknown, e: WikiEntrySummary) =>
                `${dayjs(e.updatedAt).format('DD.MM.YYYY')}${e.updatedByName ? ` · ${e.updatedByName}` : ''}`,
            },
          ]}
        />
      </Card>
    </div>
  );
};
