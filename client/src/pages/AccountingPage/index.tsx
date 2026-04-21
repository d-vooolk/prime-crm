import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select,
  DatePicker, message, Statistic, Card, Tag, Empty,
} from 'antd';
import {
  PlusOutlined, MinusOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { CashTransaction, CapitalTransaction, Serviceman } from '@/types';
import { accountingApi, SalaryData, SalaryRecord } from '@/api/accounting.api';
import { servicesApi } from '@/api/services.api';
import { formatPrice } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import styles from './AccountingPage.module.scss';

const MANAGER_ROLES = ['Создатель', 'Директор', 'Менеджер'];
const DIRECTOR_ROLES = ['Создатель', 'Директор'];

function formatDate(s: string) {
  return dayjs(s).format('DD.MM.YYYY');
}

const incomeColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) },
  {
    title: 'Клиент / Источник', key: 'client', ellipsis: true,
    render: (_: unknown, r: CashTransaction) =>
      r.type === 'MANUAL_INCOME'
        ? <Tag color="blue">Ввод: {r.description}</Tag>
        : r.clientName,
  },
  {
    title: 'Авто', key: 'car', ellipsis: true,
    render: (_: unknown, r: CashTransaction) => r.carInfo || '—',
  },
  {
    title: 'Телефон', key: 'phone', width: 130,
    render: (_: unknown, r: CashTransaction) => r.clientPhone || '—',
  },
  {
    title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 110,
    render: (v: number) => <strong>{formatPrice(v)}</strong>,
  },
];

const incomeRsCols = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) },
  { title: 'Клиент', key: 'client', ellipsis: true, render: (_: unknown, r: CashTransaction) => r.clientName },
  { title: 'Авто', key: 'car', ellipsis: true, render: (_: unknown, r: CashTransaction) => r.carInfo || '—' },
  { title: 'Телефон', key: 'phone', width: 130, render: (_: unknown, r: CashTransaction) => r.clientPhone || '—' },
  { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 110, render: (v: number) => <strong>{formatPrice(v)}</strong> },
];

const expenseColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) },
  { title: 'Цель', dataIndex: 'description', key: 'desc', ellipsis: true },
  { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 110, render: (v: number) => <strong>{formatPrice(v)}</strong> },
  { title: 'Изыматель', dataIndex: 'person', key: 'person', width: 130 },
];

const depositColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) },
  { title: 'BYN', dataIndex: 'amountByn', key: 'byn', width: 100, render: (v?: number) => v != null ? formatPrice(v) : '—' },
  { title: 'USD', dataIndex: 'amountUsd', key: 'usd', width: 100, render: (v?: number) => v != null ? `$${v.toFixed(2)}` : '—' },
];

const withdrawalColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) },
  { title: 'BYN', dataIndex: 'amountByn', key: 'byn', width: 100, render: (v?: number) => v != null ? formatPrice(v) : '—' },
  { title: 'USD', dataIndex: 'amountUsd', key: 'usd', width: 100, render: (v?: number) => v != null ? `$${v.toFixed(2)}` : '—' },
  { title: 'Цель', dataIndex: 'description', key: 'description', ellipsis: true, render: (v?: string) => v || '—' },
  { title: 'Изыматель', dataIndex: 'person', key: 'person', width: 130 },
];

export const AccountingPage: React.FC = () => {
  const { user } = useAuthStore();
  const canSeeCashflow = user?.isMaster || MANAGER_ROLES.includes(user?.role || '');
  const canSeeCapital = user?.isMaster || DIRECTOR_ROLES.includes(user?.role || '');

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [income, setIncome] = useState<CashTransaction[]>([]);
  const [incomeRs, setIncomeRs] = useState<CashTransaction[]>([]);
  const [expenses, setExpenses] = useState<CashTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);

  const [deposits, setDeposits] = useState<CapitalTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<CapitalTransaction[]>([]);
  const [capitalBalance, setCapitalBalance] = useState({ byn: 0, usd: 0 });

  const [employees, setEmployees] = useState<Serviceman[]>([]);
  const [salaryMonth, setSalaryMonth] = useState<Dayjs>(dayjs());
  const [salaryEmployee, setSalaryEmployee] = useState<string>('');
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [manualIncomeOpen, setManualIncomeOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expenseForm] = Form.useForm();
  const [manualIncomeForm] = Form.useForm();
  const [depositForm] = Form.useForm();
  const [withdrawalForm] = Form.useForm();

  const defaultPerson = servicemen.find(s => s.isDefault)?.name || '';
  const managerServicemen = servicemen.filter(s => !s.isDismissed && MANAGER_ROLES.includes(s.role || ''));
  const directorServicemen = servicemen.filter(s => !s.isDismissed && DIRECTOR_ROLES.includes(s.role || ''));

  const loadCash = useCallback(async () => {
    const data = await accountingApi.getCash(selectedMonth.year(), selectedMonth.month() + 1).catch(() => null);
    if (data) { setIncome(data.income); setIncomeRs(data.incomeRs); setExpenses(data.expenses); }
    const bal = await accountingApi.getBalance().catch(() => 0);
    setBalance(bal);
  }, [selectedMonth]);

  const loadCapital = useCallback(async () => {
    if (!canSeeCapital) return;
    const data = await accountingApi.getCapital().catch(() => null);
    if (data) { setDeposits(data.deposits); setWithdrawals(data.withdrawals); }
    const bal = await accountingApi.getCapitalBalance().catch(() => ({ byn: 0, usd: 0 }));
    setCapitalBalance(bal);
  }, [canSeeCapital]);

  useEffect(() => { loadCash(); }, [loadCash]);
  useEffect(() => { loadCapital(); }, [loadCapital]);
  useEffect(() => {
    servicesApi.getServicemen().then(setServicemen).catch(() => {});
    servicesApi.getAllServicemen().then(all => setEmployees(all.filter(s => s.role === 'Сотрудник' && !s.isDismissed))).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'Сотрудник' && user.name && !salaryEmployee) {
      setSalaryEmployee(user.name);
    }
  }, [user, salaryEmployee]);

  const loadSalary = useCallback(async () => {
    if (!salaryEmployee) { setSalaryData(null); return; }
    setSalaryLoading(true);
    try {
      const data = await accountingApi.getSalary(salaryEmployee, salaryMonth.year(), salaryMonth.month() + 1);
      setSalaryData(data);
    } catch { setSalaryData(null); }
    finally { setSalaryLoading(false); }
  }, [salaryEmployee, salaryMonth]);

  useEffect(() => { loadSalary(); }, [loadSalary]);

  useEffect(() => {
    if (expenseOpen) expenseForm.setFieldsValue({ person: defaultPerson, date: dayjs() });
  }, [expenseOpen, defaultPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (manualIncomeOpen) manualIncomeForm.setFieldsValue({ person: defaultPerson, date: dayjs() });
  }, [manualIncomeOpen, defaultPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (depositOpen) depositForm.setFieldsValue({ date: dayjs(), currency: 'BYN' });
  }, [depositOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (withdrawalOpen) withdrawalForm.setFieldsValue({ date: dayjs(), currency: 'BYN', person: defaultPerson });
  }, [withdrawalOpen, defaultPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateExpense = async () => {
    const values = await expenseForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createExpense({
        date: values.date.toISOString(),
        description: values.description,
        amount: values.amount,
        person: values.person,
      });
      message.success('Расход добавлен');
      setExpenseOpen(false);
      expenseForm.resetFields();
      loadCash();
    } catch { message.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const handleCreateManualIncome = async () => {
    const values = await manualIncomeForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createManualIncome({
        date: values.date.toISOString(),
        description: values.description,
        amount: values.amount,
        person: values.person,
      });
      message.success('Приход добавлен');
      setManualIncomeOpen(false);
      manualIncomeForm.resetFields();
      loadCash();
    } catch { message.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const handleCreateDeposit = async () => {
    const values = await depositForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createDeposit({
        date: values.date.toISOString(),
        amount: values.amount,
        currency: values.currency,
      });
      message.success('Пополнение добавлено');
      setDepositOpen(false);
      depositForm.resetFields();
      loadCapital();
    } catch { message.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const handleCreateWithdrawal = async () => {
    const values = await withdrawalForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createWithdrawal({
        date: values.date.toISOString(),
        amount: values.amount,
        currency: values.currency,
        description: values.description,
        person: values.person,
      });
      message.success('Списание добавлено');
      setWithdrawalOpen(false);
      withdrawalForm.resetFields();
      loadCapital();
    } catch { message.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const incomeRsTotal = incomeRs.reduce((s, r) => s + r.amount, 0);

  const cashFlowTab = (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        <Card size="small" className={styles.balanceCard}>
          <Statistic
            title="Баланс (наличные)"
            value={balance}
            precision={2}
            suffix="р."
            valueStyle={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 22 }}
          />
        </Card>

        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={v => v && setSelectedMonth(v)}
          format="MMMM YYYY"
          allowClear={false}
          style={{ width: 160 }}
        />

        <div className={styles.actions}>
          <Button icon={<MinusOutlined />} danger onClick={() => setExpenseOpen(true)}>
            Изъять средства
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setManualIncomeOpen(true)}>
            Ввод средств
          </Button>
        </div>
      </div>

      <div className={styles.tablesGrid}>
        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Приход (наличные)</div>
          <div className={styles.tableBlock}>
            <Table<CashTransaction>
              dataSource={income}
              columns={incomeColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 500 }}
              footer={() => (
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  Итого: {formatPrice(incomeTotal)}
                </div>
              )}
            />
          </div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Приход РС</div>
          <div className={styles.tableBlock}>
            <Table<CashTransaction>
              dataSource={incomeRs}
              columns={incomeRsCols}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 500 }}
              footer={() => (
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  Итого: {formatPrice(incomeRsTotal)}
                </div>
              )}
            />
          </div>
        </div>

        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Расход</div>
          <div className={styles.tableBlock}>
            <Table<CashTransaction>
              dataSource={expenses}
              columns={expenseColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 500 }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const capitalTab = canSeeCapital ? (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        <Card size="small" className={styles.balanceCard}>
          <Statistic
            title="Баланс BYN"
            value={capitalBalance.byn}
            precision={2}
            suffix="р."
            valueStyle={{ color: capitalBalance.byn >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 22 }}
          />
        </Card>
        <Card size="small" className={styles.balanceCard}>
          <Statistic
            title="Баланс USD"
            value={capitalBalance.usd}
            precision={2}
            prefix="$"
            valueStyle={{ color: capitalBalance.usd >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 22 }}
          />
        </Card>
        <div className={styles.actions}>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setDepositOpen(true)}>
            Внести
          </Button>
          <Button icon={<MinusOutlined />} danger onClick={() => setWithdrawalOpen(true)}>
            Списать
          </Button>
        </div>
      </div>

      <div className={styles.tablesGrid}>
        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Пополнения</div>
          <div className={styles.tableBlock}>
            <Table<CapitalTransaction>
              dataSource={deposits}
              columns={depositColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 350 }}
            />
          </div>
        </div>
        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Списания</div>
          <div className={styles.tableBlock}>
            <Table<CapitalTransaction>
              dataSource={withdrawals}
              columns={withdrawalColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 350 }}
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const isSotrudnik = user?.role === 'Сотрудник';

  const salaryColumns = [
    {
      title: 'Клиент',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (name: string, row: SalaryRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{row.carInfo}</div>
        </div>
      ),
    },
    {
      title: 'Дата',
      dataIndex: 'scheduledAt',
      key: 'date',
      width: 110,
      render: (d: string) => dayjs(d).format('DD.MM.YYYY'),
    },
    {
      title: 'Чистая прибыль',
      dataIndex: 'totalNetProfit',
      key: 'netProfit',
      width: 140,
      render: (v: number) => formatPrice(v),
    },
    {
      title: 'К выплате',
      dataIndex: 'totalPayment',
      key: 'payment',
      width: 120,
      render: (v: number) => <strong style={{ color: 'var(--color-success)' }}>{formatPrice(v)}</strong>,
    },
  ];

  const periodLabel = salaryData
    ? `${dayjs(salaryData.periodFrom).format('DD.MM.YYYY')} — ${dayjs(salaryData.periodTo).subtract(1, 'day').format('DD.MM.YYYY')}`
    : '';

  const salaryTab = (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        {salaryData && (
          <Card size="small" className={styles.balanceCard}>
            <Statistic
              title="К выплате за период"
              value={salaryData.totalPayment}
              precision={2}
              suffix="р."
              valueStyle={{ color: 'var(--color-success)', fontSize: 22 }}
            />
          </Card>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isSotrudnik && (
            <Select
              showSearch
              style={{ width: 200 }}
              placeholder="Выберите сотрудника"
              value={salaryEmployee || undefined}
              onChange={setSalaryEmployee}
              options={employees.map(e => ({ value: e.name, label: e.name }))}
              allowClear
              onClear={() => setSalaryEmployee('')}
            />
          )}
          <DatePicker
            picker="month"
            value={salaryMonth}
            onChange={v => v && setSalaryMonth(v)}
            format="MMMM YYYY"
            allowClear={false}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {salaryEmployee && salaryData ? (
        <>
          <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Период: <strong>{periodLabel}</strong>
            {salaryData.profitPercent > 0 && (
              <span style={{ marginLeft: 16 }}>Процент: <Tag color="blue">{salaryData.profitPercent}%</Tag></span>
            )}
          </div>
          <Table<SalaryRecord>
            dataSource={salaryData.records}
            columns={salaryColumns}
            rowKey="recordId"
            size="small"
            pagination={false}
            loading={salaryLoading}
            expandable={{
              expandedRowRender: (row: SalaryRecord) => (
                <Table
                  dataSource={row.items}
                  rowKey="serviceName"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Услуга', dataIndex: 'serviceName', key: 'name' },
                    { title: 'Чистая прибыль', dataIndex: 'netProfit', key: 'netProfit', width: 140, render: (v: number) => formatPrice(v) },
                    { title: 'К выплате', dataIndex: 'payment', key: 'payment', width: 120, render: (v: number) => <strong style={{ color: 'var(--color-success)' }}>{formatPrice(v)}</strong> },
                  ]}
                />
              ),
            }}
            footer={() => (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                <span>Итого чистая прибыль: <strong>{formatPrice(salaryData.totalNetProfit)}</strong></span>
                <span>Итого к выплате: <strong style={{ color: 'var(--color-success)' }}>{formatPrice(salaryData.totalPayment)}</strong></span>
              </div>
            )}
          />
        </>
      ) : (
        <Empty description={salaryEmployee ? 'Нет данных за период' : 'Выберите сотрудника'} style={{ marginTop: 40 }} />
      )}
    </div>
  );

  const tabItems = [
    ...(canSeeCashflow ? [{ key: 'cashflow', label: 'Приходно-Расходный', children: cashFlowTab }] : []),
    ...(canSeeCapital ? [{ key: 'capital', label: 'Капитал', children: capitalTab }] : []),
    { key: 'salary', label: 'Расчёт ЗП', children: salaryTab },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Бухгалтерия</h1>
      <Tabs items={tabItems} />

      <Modal
        title="Изъять средства"
        open={expenseOpen}
        onCancel={() => setExpenseOpen(false)}
        onOk={handleCreateExpense}
        okText="Добавить"
        okButtonProps={{ loading: saving, danger: true }}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form form={expenseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Цель изъятия" name="description" rules={[{ required: true, message: 'Укажите цель' }]}>
            <Input placeholder="Например: закупка расходников" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
            <Select
              showSearch
              placeholder="Выберите сотрудника"
              options={managerServicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ввод средств"
        open={manualIncomeOpen}
        onCancel={() => setManualIncomeOpen(false)}
        onOk={handleCreateManualIncome}
        okText="Добавить"
        okButtonProps={{ loading: saving }}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form form={manualIncomeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Источник" name="description" rules={[{ required: true, message: 'Укажите источник' }]}>
            <Input placeholder="Например: перевод от учредителя" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item label="Дебетор" name="person" rules={[{ required: true, message: 'Выберите дебетора' }]}>
            <Select
              showSearch
              placeholder="Выберите сотрудника"
              options={managerServicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Внести в капитал"
        open={depositOpen}
        onCancel={() => setDepositOpen(false)}
        onOk={handleCreateDeposit}
        okText="Внести"
        okButtonProps={{ loading: saving }}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form form={depositForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item label="Валюта" name="currency" rules={[{ required: true }]}>
            <Select options={[{ value: 'BYN', label: 'BYN (рубли)' }, { value: 'USD', label: 'USD (доллары)' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Списать из капитала"
        open={withdrawalOpen}
        onCancel={() => setWithdrawalOpen(false)}
        onOk={handleCreateWithdrawal}
        okText="Списать"
        okButtonProps={{ loading: saving, danger: true }}
        cancelText="Отмена"
        destroyOnClose
      >
        <Form form={withdrawalForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item label="Валюта" name="currency" rules={[{ required: true }]}>
            <Select options={[{ value: 'BYN', label: 'BYN (рубли)' }, { value: 'USD', label: 'USD (доллары)' }]} />
          </Form.Item>
          <Form.Item label="Цель списания" name="description">
            <Input placeholder="Например: дивиденды, личные нужды" />
          </Form.Item>
          <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
            <Select
              showSearch
              placeholder="Выберите сотрудника"
              options={directorServicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
