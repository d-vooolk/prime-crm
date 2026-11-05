import { Router } from 'express';
import { accountingController } from '../controllers/accounting.controller';
import { vdfOrdersController } from '../controllers/vdfOrders.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';
import { hiddenInLiteMode } from '../utils/liteMode';

const router = Router();

/*
 * Права повторяют вкладки бухгалтерии в интерфейсе:
 *  - менеджер: касса, приход РС, долги, выплата ЗП, премии/штрафы, заказы сотрудников из vdf.by;
 *  - директор: капитал, ЗП учредителей, статистика, правка и удаление долгов;
 *  - создатель: правка и удаление операций кассы;
 *  - сотрудник: только своя зарплата (проверка в контроллере) и курсы валют.
 */
const manager = requireRole(ROLES.MANAGER);
const director = requireRole(ROLES.DIRECTOR);
const creator = requireRole(ROLES.CREATOR);
// В облегчённом режиме (после тревожной кнопки) остаются только «Приход» (РС) и долги
const hidden = hiddenInLiteMode;

// Касса
router.get('/cash', manager, accountingController.getCash);
router.get('/balance', hidden, manager, accountingController.getBalance);
router.post('/expense', hidden, manager, accountingController.createExpense);
router.post('/manual-income', hidden, manager, accountingController.createManualIncome);
router.patch('/cash/:id', creator, accountingController.updateCashTransaction);
router.delete('/cash/:id', creator, accountingController.deleteCashTransaction);

// Капитал
router.get('/capital', hidden, director, accountingController.getCapital);
router.get('/capital/balance', hidden, director, accountingController.getCapitalBalance);
router.post('/capital/deposit', hidden, director, accountingController.createDeposit);
router.post('/capital/withdrawal', hidden, director, accountingController.createWithdrawal);
// Отчисление в капитал делают из кассы — доступно менеджерам
router.post('/capital/transfer', hidden, manager, accountingController.createCapitalTransfer);
router.get('/rates', accountingController.getRates);

// Статистика по месяцам: читают графики дашборда (менеджеры), правят директора
router.get('/monthly-revenue', hidden, manager, accountingController.getMonthlyRevenue);
router.post('/monthly-revenue', hidden, director, accountingController.setMonthlyRevenue);
router.get('/monthly-record-count', hidden, manager, accountingController.getMonthlyRecordCount);
router.post('/monthly-record-count', hidden, director, accountingController.setMonthlyRecordCount);

// Зарплата
router.get('/salary', hidden, accountingController.getSalary);
router.get('/salary/history', hidden, accountingController.getSalaryHistory);
// Зарплатный фонд — сумма начислений всех сотрудников, рядом с балансом кассы
router.get('/salary/fund', hidden, manager, accountingController.getSalaryFund);
// Дашборд «Сотрудники»: пьедестал — всем ролям, упущенная премия за вики — своя (сотрудник) или всех (менеджер)
router.get('/leaders', hidden, accountingController.getLeaders);
router.get('/missed-wiki', hidden, accountingController.getMissedWiki);
router.post('/salary-adjustments', hidden, manager, accountingController.createAdjustment);
router.delete('/salary-adjustments/:id', hidden, manager, accountingController.deleteAdjustment);
router.post('/salary-payments', hidden, manager, accountingController.createSalaryPayment);
router.delete('/salary-payments/:id', hidden, manager, accountingController.deleteSalaryPayment);
router.get('/founder-salaries', hidden, director, accountingController.getFounderSalaries);

// Долги
router.get('/debts', manager, accountingController.getDebts);
router.post('/debts', manager, accountingController.createDebt);
router.patch('/debts/:id', director, accountingController.updateDebt);
router.delete('/debts/:id', director, accountingController.deleteDebt);
router.post('/debts/:id/payments', manager, accountingController.payDebt);

// Заказы сотрудников из магазина vdf.by: исполнение создаёт расход в кассе
router.use('/vdf-orders', hidden);
router.get('/vdf-orders', manager, vdfOrdersController.list);
router.get('/vdf-orders/pending-count', manager, vdfOrdersController.pendingCount);
router.post('/vdf-orders/pay', manager, vdfOrdersController.payAll);
router.patch('/vdf-orders/:id', manager, vdfOrdersController.updateAmount);
router.post('/vdf-orders/:id/execute', manager, vdfOrdersController.execute);
router.post('/vdf-orders/:id/cancel', manager, vdfOrdersController.cancel);
router.post('/vdf-orders/:id/restore', manager, vdfOrdersController.restore);

export default router;
