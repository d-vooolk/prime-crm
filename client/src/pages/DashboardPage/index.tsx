import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Statistic, Skeleton, Tabs, Avatar, Modal } from 'antd';
import { CheckCircleOutlined, DollarOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { analyticsApi, Period } from '@/api/analytics.api';
import { accountingApi, SalaryData, SalaryHistoryItem, MonthlyRevenueItem, MonthlyRecordCountItem } from '@/api/accounting.api';
import { servicesApi } from '@/api/services.api';
import { formatPrice } from '@/utils/formatters';
import { averageAnnualSalary, effectiveSalaryMonth } from '@/utils/salary';
import { Serviceman } from '@/types';
import { useAuthStore } from '@/store/authStore';
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
  const { user } = useAuthStore();
  const canSeeRevenue = user?.isMaster || ['Создатель', 'Директор'].includes(user?.role || '');
  const canSeeAvgCard = user?.isMaster || ['Создатель', 'Директор', 'Менеджер'].includes(user?.role || '');
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<{ closedCount: number; totalRevenue: number; activeRecords: number } | null>(null);
  const [topServices, setTopServices] = useState<Array<{ service: { name: string }; count: number; total: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueItem[]>([]);
  const [monthlyRecordCount, setMonthlyRecordCount] = useState<MonthlyRecordCountItem[]>([]);

  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [salaries, setSalaries] = useState<Record<string, SalaryData>>({});
  const [histories, setHistories] = useState<Record<string, SalaryHistoryItem[]>>({});
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<Serviceman | null>(null);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      analyticsApi.getSummary(period),
      analyticsApi.getTopServices(period),
      accountingApi.getMonthlyRevenue().catch(() => [] as MonthlyRevenueItem[]),
      accountingApi.getMonthlyRecordCount().catch(() => [] as MonthlyRecordCountItem[]),
    ])
      .then(([s, t, mr, mrc]) => {
        setSummary(s);
        setTopServices(t);
        setMonthlyRevenue([...mr].reverse()); // oldest first for chart
        setMonthlyRecordCount([...mrc].reverse());
      })
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    setSalaryLoading(true);
    // Тот же расчётный период, что и в бухгалтерии: с 25-го числа идёт следующий месяц
    const period = effectiveSalaryMonth();
    const year = period.year();
    const month = period.month() + 1;

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

  const salaryPeriodLabel = effectiveSalaryMonth().format('MMMM YYYY');

  const selectedHistory = selectedEmployee ? (histories[selectedEmployee.name] ?? []) : [];
  const selectedSalary = selectedEmployee ? salaries[selectedEmployee.name] : null;
  const selectedRecord = getRecord(selectedHistory);
  const selectedAvgAnnual = averageAnnualSalary(selectedHistory);

  // Avg check per month from monthly revenue / record count
  const avgCheckData = (() => {
    const rcMap = new Map(monthlyRecordCount.map(r => [r.key, r.count]));
    return monthlyRevenue.map(r => ({
      key: r.key,
      labelShort: r.labelShort,
      label: r.label,
      avg: (rcMap.get(r.key) ?? 0) > 0 ? r.amount / rcMap.get(r.key)! : 0,
    }));
  })();

  const overallAvgCheck = (() => {
    const months = avgCheckData.filter(r => r.avg > 0);
    if (months.length === 0) return 0;
    return months.reduce((s, r) => s + r.avg, 0) / months.length;
  })();

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
                  <Col xs={12} sm={canSeeAvgCard ? 6 : 8}>
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
                  <Col xs={12} sm={canSeeAvgCard ? 6 : 8}>
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
                  <Col xs={12} sm={canSeeAvgCard ? 6 : 8}>
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
                  {canSeeAvgCard && (
                    <Col xs={12} sm={6}>
                      <Card>
                        {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                          <Statistic
                            title="Ср. чек (за всё время)"
                            value={overallAvgCheck}
                            formatter={v => formatPrice(Number(v))}
                            prefix={<TrophyOutlined style={{ color: '#f59e0b' }} />}
                          />
                        )}
                      </Card>
                    </Col>
                  )}
                </Row>

                <Row gutter={[16, 16]}>
                  {canSeeRevenue && (
                    <Col xs={24} lg={14}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Card title="Выручка по месяцам">
                          {monthlyRevenue.length > 1 ? (
                            <ResponsiveContainer width="100%" height={160}>
                              <LineChart data={monthlyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} width={44} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const item = payload[0].payload as MonthlyRevenueItem;
                                    return (
                                      <div className={styles.chartTooltip}>
                                        <div className={styles.tooltipLabel}>{item.label}</div>
                                        <div>Выручка: <strong style={{ color: '#22c55e' }}>{formatPrice(item.amount)}</strong></div>
                                      </div>
                                    );
                                  }}
                                />
                                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={monthlyRevenue.length <= 12} activeDot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Нет данных</div>
                          )}
                        </Card>

                        <Card title="Количество записей по месяцам">
                          {monthlyRecordCount.length > 1 ? (
                            <ResponsiveContainer width="100%" height={160}>
                              <LineChart data={monthlyRecordCount}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} width={32} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const item = payload[0].payload as MonthlyRecordCountItem;
                                    return (
                                      <div className={styles.chartTooltip}>
                                        <div className={styles.tooltipLabel}>{item.label}</div>
                                        <div>Записей: <strong style={{ color: '#3b82f6' }}>{item.count}</strong></div>
                                      </div>
                                    );
                                  }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={monthlyRecordCount.length <= 12} activeDot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Нет данных</div>
                          )}
                        </Card>

                        <Card title="Средний чек по месяцам">
                          {avgCheckData.filter(r => r.avg > 0).length > 1 ? (
                            <ResponsiveContainer width="100%" height={160}>
                              <LineChart data={avgCheckData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} width={44} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const item = payload[0].payload as typeof avgCheckData[number];
                                    return (
                                      <div className={styles.chartTooltip}>
                                        <div className={styles.tooltipLabel}>{item.label}</div>
                                        <div>Средний чек: <strong style={{ color: '#f59e0b' }}>{item.avg > 0 ? formatPrice(item.avg) : '—'}</strong></div>
                                      </div>
                                    );
                                  }}
                                />
                                <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2} dot={avgCheckData.length <= 12} activeDot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Нет данных</div>
                          )}
                        </Card>
                      </div>
                    </Col>
                  )}
                  <Col xs={24} lg={canSeeRevenue ? 10 : 24}>
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
                      const avgAnnual = averageAnnualSalary(history);
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
                                <span className={styles.statLabel}>Заработок (тек. период)</span>
                                <span className={styles.statEarnings}>
                                  {salary ? formatPrice(salary.adjustedTotal) : '—'}
                                </span>
                              </div>
                              {avgAnnual.monthsCount > 0 && (
                                <div className={styles.employeeStat}>
                                  <span className={styles.statLabel}>Средний годичный</span>
                                  <span className={styles.statAvg}>{formatPrice(avgAnnual.average)}</span>
                                </div>
                              )}
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
              <Col xs={12} sm={12}>
                <Card size="small">
                  <Statistic
                    title="% от прибыли"
                    value={selectedEmployee.profitPercent ?? 0}
                    suffix="%"
                    valueStyle={{ fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12}>
                <Card size="small">
                  <Statistic
                    title="Тек. период"
                    value={selectedSalary?.adjustedTotal ?? 0}
                    precision={2}
                    suffix="р."
                    valueStyle={{ color: '#22c55e', fontSize: 20 }}
                  />
                  <div className={styles.statHint}>{salaryPeriodLabel}</div>
                </Card>
              </Col>
              <Col xs={12} sm={12}>
                <Card size="small">
                  <Statistic
                    title="Средний годичный"
                    value={selectedAvgAnnual.average}
                    precision={2}
                    suffix="р."
                    valueStyle={{ color: 'var(--color-primary)', fontSize: 20 }}
                  />
                  <div className={styles.statHint}>
                    {selectedAvgAnnual.monthsCount > 0
                      ? `в месяц, за последние ${selectedAvgAnnual.monthsCount} мес.`
                      : 'нет закрытых месяцев'}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12}>
                <Card size="small">
                  <Statistic
                    title="Рекорд"
                    value={selectedRecord?.adjustedTotal ?? 0}
                    precision={2}
                    suffix="р."
                    valueStyle={{ color: '#f59e0b', fontSize: 20 }}
                  />
                  {selectedRecord && (
                    <div className={styles.statHint}>
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
