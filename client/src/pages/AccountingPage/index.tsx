import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select,
  DatePicker, message, Statistic, Card, Row, Col, Tag,
} from 'antd';
import {
  PlusOutlined, MinusOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { CashTransaction, CapitalTransaction, Serviceman } from '@/types';
import { accountingApi } from '@/api/accounting.api';
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
  { title: 'Изыматель', dataIndex: 'person', key: 'person' },
];

export const AccountingPage: React.FC = () => {
  const { user } = useAuthStore();
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
  }, []);

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

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <div className={styles.tableTitle}>Приход (наличные)</div>
          <Table<CashTransaction>
            dataSource={income}
            columns={incomeColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 400 }}
            footer={() => (
              <div style={{ textAlign: 'right', fontWeight: 700 }}>
                Итого: {formatPrice(incomeTotal)}
              </div>
            )}
          />
        </Col>

        <Col xs={24} lg={8}>
          <div className={styles.tableTitle}>Приход РС</div>
          <Table<CashTransaction>
            dataSource={incomeRs}
            columns={incomeRsCols}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 400 }}
            footer={() => (
              <div style={{ textAlign: 'right', fontWeight: 700 }}>
                Итого: {formatPrice(incomeRsTotal)}
              </div>
            )}
          />
        </Col>

        <Col xs={24} lg={8}>
          <div className={styles.tableTitle}>Расход</div>
          <Table<CashTransaction>
            dataSource={expenses}
            columns={expenseColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 400 }}
          />
        </Col>
      </Row>
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

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <div className={styles.tableTitle}>Пополнения</div>
          <Table<CapitalTransaction>
            dataSource={deposits}
            columns={depositColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 350 }}
          />
        </Col>
        <Col xs={24} lg={12}>
          <div className={styles.tableTitle}>Списания</div>
          <Table<CapitalTransaction>
            dataSource={withdrawals}
            columns={withdrawalColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 350 }}
          />
        </Col>
      </Row>
    </div>
  ) : null;

  const tabItems = [
    { key: 'cashflow', label: 'Приходно-Расходный', children: cashFlowTab },
    ...(canSeeCapital ? [{ key: 'capital', label: 'Капитал', children: capitalTab }] : []),
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
