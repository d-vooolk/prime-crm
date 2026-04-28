import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select,
  DatePicker, message, Statistic, Card, Tag, Empty, Popconfirm, Space, Tooltip, Switch,
} from 'antd';
import {
  PlusOutlined, MinusOutlined, EditOutlined, DeleteOutlined, RetweetOutlined,
} from '@ant-design/icons';
import { recordsApi } from '@/api/records.api';
import dayjs, { Dayjs } from 'dayjs';
import { CashTransaction, CapitalTransaction, Serviceman } from '@/types';
import { accountingApi, SalaryData, SalaryRecord, SalaryAdjustment, FounderSalaryRecord } from '@/api/accounting.api';
import { servicesApi } from '@/api/services.api';
import { formatPrice } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import styles from './AccountingPage.module.scss';

const MANAGER_ROLES = ['Создатель', 'Директор', 'Менеджер'];
const DIRECTOR_ROLES = ['Создатель', 'Директор'];
const CREATOR_ROLES = ['Создатель'];

function formatDate(s: string) {
  return dayjs(s).format('DD.MM.YYYY');
}

const incomeColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  {
    title: 'Клиент / Источник', key: 'client', width: 160, ellipsis: true,
    render: (_: unknown, r: CashTransaction) =>
      r.type === 'MANUAL_INCOME'
        ? <Tag color="blue">Ввод: {r.description}</Tag>
        : r.clientName,
  },
  {
    title: 'Авто', key: 'car', width: 140, ellipsis: true,
    render: (_: unknown, r: CashTransaction) => r.carInfo || '—',
  },
  {
    title: 'Телефон', key: 'phone', width: 120,
    render: (_: unknown, r: CashTransaction) => r.clientPhone || '—',
  },
  {
    title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 100,
    render: (v: number) => <strong>{formatPrice(v)}</strong>,
  },
];

const incomeRsCols = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  { title: 'Клиент', key: 'client', width: 160, ellipsis: true, render: (_: unknown, r: CashTransaction) => r.clientName },
  { title: 'Авто', key: 'car', width: 140, ellipsis: true, render: (_: unknown, r: CashTransaction) => r.carInfo || '—' },
  { title: 'Телефон', key: 'phone', width: 120, render: (_: unknown, r: CashTransaction) => r.clientPhone || '—' },
  { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => <strong>{formatPrice(v)}</strong> },
];

const expenseColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  { title: 'Цель', dataIndex: 'description', key: 'desc', width: 160, ellipsis: true },
  { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => <strong>{formatPrice(v)}</strong> },
  { title: 'Изыматель', dataIndex: 'person', key: 'person', width: 120 },
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
  const canEditTransactions = user?.isMaster || CREATOR_ROLES.includes(user?.role || '');

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
  const [salaryMonth, setSalaryMonth] = useState<Dayjs>(() => {
    const today = dayjs();
    return today.date() >= 25 ? today.add(1, 'month').startOf('month') : today.startOf('month');
  });
  const [salaryEmployee, setSalaryEmployee] = useState<string>('');
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [fineOpen, setFineOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [fineForm] = Form.useForm();
  const [bonusForm] = Form.useForm();

  const [founderSalaries, setFounderSalaries] = useState<FounderSalaryRecord[]>([]);
  const [isFounderSalary, setIsFounderSalary] = useState(false);
  const [founderPerson, setFounderPerson] = useState('');

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [manualIncomeOpen, setManualIncomeOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expenseForm] = Form.useForm();
  const [manualIncomeForm] = Form.useForm();
  const [depositForm] = Form.useForm();
  const [withdrawalForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [transferModal, setTransferModal] = useState<{ recordId: string; salaryDate: Dayjs | null } | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);

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

  const loadFounderSalaries = useCallback(async () => {
    const data = await accountingApi.getFounderSalaries().catch(() => []);
    setFounderSalaries(data);
  }, []);

  useEffect(() => { loadCash(); }, [loadCash]);
  useEffect(() => { loadCapital(); }, [loadCapital]);
  useEffect(() => { loadFounderSalaries(); }, [loadFounderSalaries]);
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
    if (expenseOpen) {
      expenseForm.setFieldsValue({ person: defaultPerson, date: dayjs() });
      setIsFounderSalary(false);
      setFounderPerson('');
    }
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

  const handleFounderPersonChange = (name: string) => {
    setFounderPerson(name);
    expenseForm.setFieldsValue({ description: `ЗП учредителя ${name}` });
  };

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
      if (isFounderSalary && founderPerson && values.founderMonth) {
        await accountingApi.createFounderSalary({
          year: (values.founderMonth as import('dayjs').Dayjs).year(),
          month: (values.founderMonth as import('dayjs').Dayjs).month() + 1,
          person: founderPerson,
          amount: values.amount,
        });
        loadFounderSalaries();
      }
      message.success('Расход добавлен');
      setExpenseOpen(false);
      expenseForm.resetFields();
      setIsFounderSalary(false);
      setFounderPerson('');
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

  const handleEditTx = (tx: CashTransaction) => {
    setEditingTx(tx);
    editForm.setFieldsValue({
      date: dayjs(tx.date),
      amount: tx.amount,
      description: tx.description || '',
      person: tx.person || '',
    });
    setEditOpen(true);
  };

  const handleUpdateTx = async () => {
    if (!editingTx) return;
    const values = await editForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.updateCashTransaction(editingTx.id, {
        date: values.date.toISOString(),
        amount: values.amount,
        description: values.description || undefined,
        person: values.person || undefined,
      });
      message.success('Запись обновлена');
      setEditOpen(false);
      editForm.resetFields();
      setEditingTx(null);
      loadCash();
    } catch { message.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const handleDeleteTx = async (id: string) => {
    try {
      await accountingApi.deleteCashTransaction(id);
      message.success('Запись удалена');
      loadCash();
    } catch { message.error('Ошибка при удалении'); }
  };

  const txActionColumn = canEditTransactions ? [{
    title: '',
    key: 'actions',
    width: 72,
    render: (_: unknown, r: CashTransaction) => (
      <Space size={2}>
        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEditTx(r)} />
        <Popconfirm
          title="Удалить запись?"
          onConfirm={() => handleDeleteTx(r.id)}
          okText="Да"
          cancelText="Нет"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  }] : [];

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
              columns={[...incomeColumns, ...txActionColumn]}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
              footer={() => (
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  Итого: {formatPrice(incomeTotal)}
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
              columns={[...expenseColumns, ...txActionColumn]}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 560 }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const incomeRsTab = (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={v => v && setSelectedMonth(v)}
          format="MMMM YYYY"
          allowClear={false}
          style={{ width: 160 }}
        />
      </div>

      <div className={styles.tablesGrid}>
        <div className={styles.tableSection}>
          <div className={styles.tableTitle}>Приход РС</div>
          <div className={styles.tableBlock}>
            <Table<CashTransaction>
              dataSource={incomeRs}
              columns={[...incomeRsCols, ...txActionColumn]}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
              footer={() => (
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  Итого: {formatPrice(incomeRsTotal)}
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const capitalTab = canSeeCapital ? (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        <div className={styles.balanceCards}>
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
        </div>
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

  const effectiveCurrentMonth = (() => {
    const today = dayjs();
    return today.date() >= 25 ? today.add(1, 'month').startOf('month') : today.startOf('month');
  })();
  const effectivePrevMonth = effectiveCurrentMonth.subtract(1, 'month');

  const canSeeClientName = user?.isMaster || MANAGER_ROLES.includes(user?.role || '');

  const handleTransferSalary = async () => {
    if (!transferModal) return;
    setTransferSaving(true);
    try {
      await recordsApi.setSalaryDate(
        transferModal.recordId,
        transferModal.salaryDate ? transferModal.salaryDate.toISOString() : null,
      );
      message.success('Период перенесён');
      setTransferModal(null);
      loadSalary();
    } catch {
      message.error('Не удалось перенести');
    } finally {
      setTransferSaving(false);
    }
  };

  const salaryColumns = [
    {
      title: canSeeClientName ? 'Клиент / Авто' : 'Авто',
      dataIndex: 'clientName',
      key: 'clientName',
      render: (name: string, row: SalaryRecord) => (
        <div>
          {canSeeClientName && <div style={{ fontWeight: 500 }}>{name}</div>}
          <div style={{ fontSize: canSeeClientName ? 12 : 14, color: canSeeClientName ? 'var(--color-text-secondary)' : undefined, fontWeight: canSeeClientName ? undefined : 500 }}>{row.carInfo}</div>
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
      title: 'Сумма',
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
    ...(canSeeCashflow ? [{
      title: '',
      key: 'transfer',
      width: 40,
      render: (_: unknown, row: SalaryRecord) => (
        <Tooltip title={row.salaryDate ? 'Период перенесён — изменить' : 'Перенести на другой период'}>
          <Button
            type="text"
            size="small"
            icon={<RetweetOutlined style={{ color: row.salaryDate ? 'var(--color-primary)' : undefined }} />}
            onClick={() => setTransferModal({
              recordId: row.recordId,
              salaryDate: row.salaryDate ? dayjs(row.salaryDate) : null,
            })}
          />
        </Tooltip>
      ),
    }] : []),
  ];

  const periodLabel = salaryData
    ? `${dayjs(salaryData.periodFrom).format('DD.MM.YYYY')} — ${dayjs(salaryData.periodTo).subtract(1, 'day').format('DD.MM.YYYY')}`
    : '';

  const handleCreateAdjustment = async (type: 'FINE' | 'BONUS') => {
    const form = type === 'FINE' ? fineForm : bonusForm;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setAdjSaving(true);
    try {
      await accountingApi.createAdjustment({
        servicemanName: salaryEmployee,
        type,
        amount: values.amount,
        reason: values.reason,
        year: salaryMonth.year(),
        month: salaryMonth.month() + 1,
      });
      form.resetFields();
      if (type === 'FINE') setFineOpen(false); else setBonusOpen(false);
      loadSalary();
    } catch { /* ignore */ } finally { setAdjSaving(false); }
  };

  const handleDeleteAdjustment = async (id: string) => {
    await accountingApi.deleteAdjustment(id).catch(() => {});
    loadSalary();
  };

  const salaryTab = (
    <div className={styles.tabContent}>
      <div className={styles.topBar}>
        {salaryData && (
          <Card size="small" className={styles.balanceCard}>
            <Statistic
              title="К выплате за период"
              value={salaryData.adjustedTotal ?? salaryData.totalPayment}
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
          {isSotrudnik ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                size="small"
                disabled={!salaryMonth.isAfter(effectivePrevMonth, 'month')}
                onClick={() => setSalaryMonth(prev => prev.subtract(1, 'month'))}
              >←</Button>
              <span style={{ fontSize: 14, minWidth: 110, textAlign: 'center' }}>
                {salaryMonth.format('MMMM YYYY')}
              </span>
              <Button
                size="small"
                disabled={!salaryMonth.isBefore(effectiveCurrentMonth, 'month')}
                onClick={() => setSalaryMonth(prev => prev.add(1, 'month'))}
              >→</Button>
            </div>
          ) : (
            <DatePicker
              picker="month"
              value={salaryMonth}
              onChange={v => v && setSalaryMonth(v)}
              format="MMMM YYYY"
              allowClear={false}
              style={{ width: 160 }}
            />
          )}
          {!isSotrudnik && salaryEmployee && (
            <>
              <Button
                danger
                icon={<MinusOutlined />}
                onClick={() => { fineForm.resetFields(); setFineOpen(true); }}
              >
                Штраф
              </Button>
              <Button
                style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                icon={<PlusOutlined />}
                onClick={() => { bonusForm.resetFields(); setBonusOpen(true); }}
              >
                Премия
              </Button>
            </>
          )}
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
                    { title: 'Сумма', dataIndex: 'netProfit', key: 'netProfit', width: 140, render: (v: number) => formatPrice(v) },
                    { title: 'К выплате', dataIndex: 'payment', key: 'payment', width: 120, render: (v: number) => <strong style={{ color: 'var(--color-success)' }}>{formatPrice(v)}</strong> },
                  ]}
                />
              ),
            }}
            footer={() => (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                <span>База: <strong>{formatPrice(salaryData.totalPayment)}</strong></span>
              </div>
            )}
          />

          {salaryData.adjustments.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {salaryData.adjustments.map((adj: SalaryAdjustment) => (
                <div key={adj.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: adj.type === 'FINE' ? 'rgba(255,77,79,0.08)' : 'rgba(82,196,26,0.08)',
                  border: `1px solid ${adj.type === 'FINE' ? 'rgba(255,77,79,0.25)' : 'rgba(82,196,26,0.25)'}`,
                }}>
                  <Tag color={adj.type === 'FINE' ? 'red' : 'green'} style={{ margin: 0 }}>
                    {adj.type === 'FINE' ? 'Штраф' : 'Премия'}
                  </Tag>
                  <span style={{ flex: 1, fontSize: 13 }}>{adj.reason}</span>
                  <strong style={{ color: adj.type === 'FINE' ? 'var(--color-error)' : 'var(--color-success)', whiteSpace: 'nowrap' }}>
                    {adj.type === 'FINE' ? '−' : '+'}{formatPrice(adj.amount)}
                  </strong>
                  {!isSotrudnik && (
                    <Popconfirm title="Удалить?" onConfirm={() => handleDeleteAdjustment(adj.id)} okText="Да" cancelText="Нет">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, fontSize: 15, gap: 24 }}>
            {salaryData.adjustments.length > 0 && (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                База: {formatPrice(salaryData.totalPayment)}
              </span>
            )}
            <span>
              Итого к выплате:{' '}
              <strong style={{ color: 'var(--color-success)', fontSize: 17 }}>
                {formatPrice(salaryData.adjustedTotal ?? salaryData.totalPayment)}
              </strong>
            </span>
          </div>
        </>
      ) : (
        <Empty description={salaryEmployee ? 'Нет данных за период' : 'Выберите сотрудника'} style={{ marginTop: 40 }} />
      )}
    </div>
  );

  // ─── Founder salaries tab ─────────────────────────────────────────────────
  const directorUser = servicemen.find(s => !s.isDismissed && s.role === 'Директор');
  const creatorUser  = servicemen.find(s => !s.isDismissed && s.role === 'Создатель');
  const founderOptions = [directorUser, creatorUser].filter(Boolean).map(s => ({ value: s!.name, label: s!.name }));

  // Group founderSalaries by month
  const founderRowMap = new Map<string, { year: number; month: number; director: number; creator: number }>();
  for (const r of founderSalaries) {
    const key = `${String(r.month).padStart(2, '0')}.${r.year}`;
    if (!founderRowMap.has(key)) founderRowMap.set(key, { year: r.year, month: r.month, director: 0, creator: 0 });
    const row = founderRowMap.get(key)!;
    if (directorUser && r.person === directorUser.name) row.director += r.amount;
    if (creatorUser  && r.person === creatorUser.name)  row.creator  += r.amount;
  }
  const founderRows = Array.from(founderRowMap.entries())
    .sort(([, a], [, b]) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(([key, v]) => ({ key, ...v }));

  const directorTotal = founderSalaries.filter(r => directorUser && r.person === directorUser.name).reduce((s, r) => s + r.amount, 0);
  const creatorTotal  = founderSalaries.filter(r => creatorUser  && r.person === creatorUser.name).reduce((s, r) => s + r.amount, 0);
  const founderDiff   = Math.abs(directorTotal - creatorTotal);
  const lessFounder   = directorTotal < creatorTotal ? directorUser : creatorUser;

  const founderSalaryTab = (
    <div className={styles.tabContent}>
      <Table
        dataSource={founderRows}
        rowKey="key"
        size="small"
        pagination={false}
        locale={{ emptyText: 'Нет данных' }}
        columns={[
          { title: 'Месяц', dataIndex: 'key', key: 'month', width: 120 },
          {
            title: directorUser?.name ?? 'Директор',
            key: 'director',
            render: (_: unknown, row: typeof founderRows[number]) =>
              row.director > 0
                ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{formatPrice(row.director)}</span>
                : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
          },
          {
            title: creatorUser?.name ?? 'Создатель',
            key: 'creator',
            render: (_: unknown, row: typeof founderRows[number]) =>
              row.creator > 0
                ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{formatPrice(row.creator)}</span>
                : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
          },
        ]}
      />
      {founderDiff > 0 && lessFounder && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,77,79,0.07)', border: '1px solid rgba(255,77,79,0.2)', fontSize: 13 }}>
          <strong>{lessFounder.name}</strong> получил меньше на{' '}
          <strong style={{ color: 'var(--color-error)' }}>{formatPrice(founderDiff)}</strong>
        </div>
      )}
    </div>
  );

  const tabItems = [
    ...(canSeeCashflow ? [{ key: 'cashflow', label: 'Приходно-Расходный', children: cashFlowTab }] : []),
    ...(canSeeCashflow ? [{ key: 'incomers', label: 'Приход РС', children: incomeRsTab }] : []),
    ...(canSeeCapital ? [{ key: 'capital', label: 'Капитал', children: capitalTab }] : []),
    { key: 'salary', label: 'Расчёт ЗП', children: salaryTab },
    ...(canSeeCapital ? [{ key: 'founderSalary', label: 'ЗП Учредителей', children: founderSalaryTab }] : []),
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Бухгалтерия</h1>
      <Tabs items={tabItems} />

      <Modal
        title="Редактировать запись"
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); setEditingTx(null); }}
        onOk={handleUpdateTx}
        okText="Сохранить"
        okButtonProps={{ loading: saving }}
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
          </Form.Item>
          {editingTx && (editingTx.type === 'EXPENSE' || editingTx.type === 'MANUAL_INCOME') && (
            <Form.Item label={editingTx.type === 'EXPENSE' ? 'Цель изъятия' : 'Источник'} name="description">
              <Input />
            </Form.Item>
          )}
          {editingTx?.type === 'EXPENSE' && (
            <Form.Item label="Изыматель" name="person">
              <Select
                showSearch
                placeholder="Выберите сотрудника"
                options={managerServicemen.map(s => ({ value: s.name, label: s.name }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Изъять средства"
        open={expenseOpen}
        onCancel={() => setExpenseOpen(false)}
        onOk={handleCreateExpense}
        okText="Добавить"
        okButtonProps={{ loading: saving, danger: true }}
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={expenseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          {isFounderSalary && (
            <Form.Item label="Месяц ЗП" name="founderMonth" rules={[{ required: true, message: 'Выберите месяц' }]}>
              <DatePicker picker="month" style={{ width: '100%' }} format="MM.YYYY" allowClear={false} />
            </Form.Item>
          )}
          {isFounderSalary && (
            <Form.Item label="Получатель" rules={[{ required: true }]}>
              <Select
                placeholder="Выберите учредителя"
                value={founderPerson || undefined}
                onChange={handleFounderPersonChange}
                options={founderOptions}
              />
            </Form.Item>
          )}
          <Form.Item label="Цель изъятия" name="description" rules={[{ required: true, message: 'Укажите цель' }]}>
            <Input
              placeholder={isFounderSalary ? '' : 'Например: закупка расходников'}
              readOnly={isFounderSalary}
            />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
          </Form.Item>
          <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
            <Select
              showSearch
              placeholder="Выберите сотрудника"
              options={managerServicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={isFounderSalary}
                onChange={next => {
                  setIsFounderSalary(next);
                  setFounderPerson('');
                  if (!next) expenseForm.setFieldsValue({ description: '', founderMonth: null });
                  else expenseForm.setFieldsValue({ founderMonth: dayjs(), description: '' });
                }}
              />
              <span style={{ fontSize: 14 }}>ЗП учредителей</span>
            </div>
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
        destroyOnHidden
      >
        <Form form={manualIncomeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Источник" name="description" rules={[{ required: true, message: 'Укажите источник' }]}>
            <Input placeholder="Например: перевод от учредителя" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
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
        destroyOnHidden
      >
        <Form form={depositForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
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
        destroyOnHidden
      >
        <Form form={withdrawalForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
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

      <Modal
        title="Добавить штраф"
        open={fineOpen}
        onCancel={() => setFineOpen(false)}
        onOk={() => handleCreateAdjustment('FINE')}
        okText="Добавить"
        okButtonProps={{ loading: adjSaving, danger: true }}
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={fineForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Причина" name="reason" rules={[{ required: true, message: 'Укажите причину' }]}>
            <Input placeholder="Опишите причину штрафа" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Добавить премию"
        open={bonusOpen}
        onCancel={() => setBonusOpen(false)}
        onOk={() => handleCreateAdjustment('BONUS')}
        okText="Добавить"
        okButtonProps={{ loading: adjSaving }}
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={bonusForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Причина" name="reason" rules={[{ required: true, message: 'Укажите причину' }]}>
            <Input placeholder="Опишите причину премии" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} precision={2} parser={(v) => parseFloat((v ?? '').replace(/,/g, '.')) || 0} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Перенести на другой период"
        open={!!transferModal}
        onCancel={() => setTransferModal(null)}
        onOk={handleTransferSalary}
        okText="Перенести"
        okButtonProps={{ loading: transferSaving }}
        cancelText="Отмена"
        destroyOnHidden
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              danger
              disabled={!transferModal?.salaryDate}
              onClick={async () => {
                setTransferSaving(true);
                try {
                  await recordsApi.setSalaryDate(transferModal!.recordId, null);
                  message.success('Перенос сброшен');
                  setTransferModal(null);
                  loadSalary();
                } catch { message.error('Ошибка'); }
                finally { setTransferSaving(false); }
              }}
            >
              Сбросить перенос
            </Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </Space>
        )}
      >
        <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Выберите дату, в период которой нужно перенести эту запись в расчёте ЗП.
          Касса и приходно-расходная таблица не изменятся.
        </p>
        <DatePicker
          style={{ width: '100%' }}
          value={transferModal?.salaryDate ?? null}
          onChange={v => setTransferModal(prev => prev ? { ...prev, salaryDate: v } : prev)}
          format="DD.MM.YYYY"
          allowClear
        />
      </Modal>
    </div>
  );
};
