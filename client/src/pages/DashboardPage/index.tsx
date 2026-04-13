import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Statistic, Skeleton } from 'antd';
import { TeamOutlined, CheckCircleOutlined, DollarOutlined, CalendarOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyticsApi, Period } from '@/api/analytics.api';
import { formatPrice } from '@/utils/formatters';
import styles from './DashboardPage.module.scss';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

export const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<{ closedCount: number; totalRevenue: number; activeRecords: number } | null>(null);
  const [revenueData, setRevenueData] = useState<Array<{ date: string; revenue: number }>>([]);
  const [topServices, setTopServices] = useState<Array<{ service: { name: string }; count: number; total: number }>>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Дашборд</h1>
        <Select
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          style={{ width: 140 }}
        />
      </div>

      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={12} sm={6}>
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
        <Col xs={12} sm={6}>
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
        <Col xs={12} sm={6}>
          <Card>
            {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <Statistic
                title="Активных записей"
                value={summary?.activeRecords || 0}
                prefix={<CalendarOutlined style={{ color: '#f59e0b' }} />}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={6}>
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
  );
};
