import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Statistic, Skeleton, Tabs, Avatar, Modal } from 'antd';
import { CheckCircleOutlined, DollarOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { analyticsApi, Period } from '@/api/analytics.api';
import { accountingApi, SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { servicesApi } from '@/api/services.api';
import { formatPrice } from '@/utils/formatters';
import { Serviceman } from '@/types';
import styles from './DashboardPage.module.scss';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

const SalaryTooltip = ({ active, payload, label }: { active?: boolean; payload?: { payload: SalaryHistoryItem }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div>Заработок: <strong style={{ color: '#22c55e' }}>{formatPrice(item.adjustedTotal)}</strong></div>
      <div className={styles.tooltipMuted}>Машин: {item.recordCount}</div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<{ closedCount: number; totalRevenue: number; activeRecords: number } | null>(null);
  const [revenueData, setRevenueData] = useState<Array<{ date: string; revenue: number }>>([]);
  const [topServices, setTopServices] = useState<Array<{ service: { name: string }; count: number; total: number }>>([]);
  const [loading, setLoading] = useState(false);

  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [salaries, setSalaries] = useState<Record<string, SalaryData>>({});
  const [histories, setHistories] = useState<Record<string, SalaryHistoryItem[]>>({});
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<Serviceman | null>(null);

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
    const to = now.toISOString();

    Promise.all([
      analyticsApi.getSummary(period),
      analyticsApi.getRevenue(from, to),
      analyticsApi.getTopServices(period),
    ])
      .then(([s, r, t]) => {
        setSummary(s);
        setRevenueData(r);
        setTopServices(t);
      })
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    setSalaryLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    servicesApi.getServicemen()
      .then(async (men) => {
        const filtered = men.filter(m => m.role === 'Сотрудник');
        setServicemen(filtered);
        const [salaryResults, historyResults] = await Promise.all([
          Promise.all(filtered.map(m => accountingApi.getSalary(m.name, year, month).catch(() => null))),
          Promise.all(filtered.map(m => accountingApi.getSalaryHistory(m.name).catch(() => [] as SalaryHistoryItem[]))),
        ]);
        const salaryMap: Record<string, SalaryData> = {};
        const historyMap: Record<string, SalaryHistoryItem[]> = {};
        filtered.forEach((m, i) => {
          if (salaryResults[i]) salaryMap[m.name] = salaryResults[i]!;
          historyMap[m.name] = historyResults[i];
        });
        setSalaries(salaryMap);
        setHistories(historyMap);
      })
      .finally(() => setSalaryLoading(false));
  }, []);

  const getRecord = (history: SalaryHistoryItem[]) =>
    history.length > 0 ? history.reduce((max, h) => h.adjustedTotal > max.adjustedTotal ? h : max) : null;

  const selectedHistory = selectedEmployee ? (histories[selectedEmployee.name] ?? []) : [];
  const selectedSalary = selectedEmployee ? salaries[selectedEmployee.name] : null;
  const selectedRecord = getRecord(selectedHistory);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Дашборд</h1>
      </div>

      <Tabs
        items={[
          {
            key: 'main',
            label: 'Основные показатели',
            children: (
              <div className={styles.tabContent}>
                <div className={styles.tabHeader}>
                  <Select
                    value={period}
                    onChange={setPeriod}
                    options={PERIOD_OPTIONS}
                    style={{ width: 140 }}
                  />
                </div>

                <Row gutter={[16, 16]} className={styles.statsRow}>
                  <Col xs={12} sm={8}>
                    <Card>
                      {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                        <Statistic
                          title="Закрытых сделок"
                          value={summary?.closedCount || 0}
                          prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />}
                        />
                      )}
                    </Card>
                  </Col>
                  <Col xs={12} sm={8}>
                    <Card>
                      {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                        <Statistic
                          title="Выручка"
                          value={summary?.totalRevenue || 0}
                          formatter={v => formatPrice(Number(v))}
                          prefix={<DollarOutlined style={{ color: '#3b82f6' }} />}
                        />
                      )}
                    </Card>
                  </Col>
                  <Col xs={12} sm={8}>
                    <Card>
                      {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                        <Statistic
                          title="Средний чек"
                          value={summary?.closedCount ? (summary.totalRevenue / summary.closedCount) : 0}
                          formatter={v => formatPrice(Number(v))}
                          prefix={<TeamOutlined style={{ color: '#a855f7' }} />}
                        />
                      )}
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={14}>
                    <Card title="Выручка (30 дней)">
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} />
                          <Tooltip formatter={(v) => formatPrice(Number(v))} />
                          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col xs={24} lg={10}>
                    <Card title="Топ услуг">
                      {topServices.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={topServices} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="service.name" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip formatter={(v) => [`${v} раз`, 'Кол-во']} />
                            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                          Нет данных
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'employees',
            label: 'Сотрудники',
            children: (
              <div className={styles.employeesTab}>
                {salaryLoading ? (
                  <Row gutter={[16, 16]}>
                    {[1, 2, 3].map(i => (
                      <Col key={i} xs={24} sm={12} lg={8}>
                        <Card><Skeleton active avatar paragraph={{ rows: 3 }} /></Card>
                      </Col>
                    ))}
                  </Row>
                ) : servicemen.length === 0 ? (
                  <div className={styles.empty}>Нет сотрудников</div>
                ) : (
                  <Row gutter={[16, 16]}>
                    {servicemen.map(m => {
                      const salary = salaries[m.name];
                      const history = histories[m.name] ?? [];
                      const record = getRecord(history);
                      return (
                        <Col key={m.id} xs={24} sm={12} lg={8}>
                          <Card
                            className={styles.employeeCard}
                            onClick={() => setSelectedEmployee(m)}
                            hoverable
                          >
                            <div className={styles.employeeHeader}>
                              <Avatar size={48} className={styles.employeeAvatar}>
                                {m.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <div className={styles.employeeInfo}>
                                <div className={styles.employeeName}>{m.name}</div>
                                {m.position && <div className={styles.employeePosition}>{m.position}</div>}
                              </div>
                            </div>
                            <div className={styles.employeeStats}>
                              <div className={styles.employeeStat}>
                                <span className={styles.statLabel}>% от прибыли</span>
                                <span className={styles.statValue}>{m.profitPercent ?? 0}%</span>
                              </div>
                              <div className={styles.employeeStat}>
                                <span className={styles.statLabel}>Заработок (тек. месяц)</span>
                                <span className={styles.statEarnings}>
                                  {salary ? formatPrice(salary.adjustedTotal) : '—'}
                                </span>
                              </div>
                              {record && history.length > 1 && (
                                <div className={styles.employeeStat}>
                                  <span className={styles.statLabel}>Рекорд</span>
                                  <span className={styles.statRecord}>{formatPrice(record.adjustedTotal)}</span>
                                </div>
                              )}
                            </div>
                            {history.length > 1 && (
                              <div className={styles.sparkline}>
                                <ResponsiveContainer width="100%" height={56}>
                                  <LineChart data={history} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                    <Line
                                      type="monotone"
                                      dataKey="adjustedTotal"
                                      stroke="var(--color-primary)"
                                      strokeWidth={2}
                                      dot={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={!!selectedEmployee}
        onCancel={() => setSelectedEmployee(null)}
        footer={null}
        title={null}
        width={600}
        destroyOnHidden
      >
        {selectedEmployee && (
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <Avatar size={56} className={styles.employeeAvatar}>
                {selectedEmployee.name.charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <div className={styles.modalName}>{selectedEmployee.name}</div>
                {selectedEmployee.position && (
                  <div className={styles.employeePosition}>{selectedEmployee.position}</div>
                )}
              </div>
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="% от прибыли"
                    value={selectedEmployee.profitPercent ?? 0}
                    suffix="%"
                    valueStyle={{ fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Тек. месяц"
                    value={selectedSalary?.adjustedTotal ?? 0}
                    precision={2}
                    suffix="р."
                    valueStyle={{ color: '#22c55e', fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Рекорд"
                    value={selectedRecord?.adjustedTotal ?? 0}
                    precision={2}
                    suffix="р."
                    valueStyle={{ color: '#f59e0b', fontSize: 20 }}
                  />
                  {selectedRecord && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {selectedHistory.length === 1 ? 'Первый месяц' : selectedRecord.label}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            {selectedHistory.length > 1 ? (
              <Card size="small" title="Динамика заработка">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={selectedHistory} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} width={40} />
                    <Tooltip content={<SalaryTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="adjustedTotal"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={selectedHistory.length <= 12}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px 0' }}>
                Недостаточно данных для графика
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
