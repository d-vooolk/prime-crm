import { Router } from 'express';
import { accountingController } from '../controllers/accounting.controller';
import { vdfOrdersController } from '../controllers/vdfOrders.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

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

// Касса
router.get('/cash', manager, accountingController.getCash);
router.get('/balance', manager, accountingController.getBalance);
router.post('/expense', manager, accountingController.createExpense);
router.post('/manual-income', manager, accountingController.createManualIncome);
router.patch('/cash/:id', creator, accountingController.updateCashTransaction);
router.delete('/cash/:id', creator, accountingController.deleteCashTransaction);

// Капитал
router.get('/capital', director, accountingController.getCapital);
router.get('/capital/balance', director, accountingController.getCapitalBalance);
router.post('/capital/deposit', director, accountingController.createDeposit);
router.post('/capital/withdrawal', director, accountingController.createWithdrawal);
// Отчисление в капитал делают из кассы — доступно менеджерам
router.post('/capital/transfer', manager, accountingController.createCapitalTransfer);
router.get('/rates', accountingController.getRates);

// Статистика по месяцам: читают графики дашборда (менеджеры), правят директора
router.get('/monthly-revenue', manager, accountingController.getMonthlyRevenue);
router.post('/monthly-revenue', director, accountingController.setMonthlyRevenue);
router.get('/monthly-record-count', manager, accountingController.getMonthlyRecordCount);
router.post('/monthly-record-count', director, accountingController.setMonthlyRecordCount);

// Зарплата
router.get('/salary', accountingController.getSalary);
router.get('/salary/history', accountingController.getSalaryHistory);
router.post('/salary-adjustments', manager, accountingController.createAdjustment);
router.delete('/salary-adjustments/:id', manager, accountingController.deleteAdjustment);
router.post('/salary-payments', manager, accountingController.createSalaryPayment);
router.delete('/salary-payments/:id', manager, accountingController.deleteSalaryPayment);
router.get('/founder-salaries', director, accountingController.getFounderSalaries);

// Долги
router.get('/debts', manager, accountingController.getDebts);
router.post('/debts', manager, accountingController.createDebt);
router.patch('/debts/:id', director, accountingController.updateDebt);
router.delete('/debts/:id', director, accountingController.deleteDebt);
router.post('/debts/:id/payments', manager, accountingController.payDebt);

// Заказы сотрудников из магазина vdf.by: исполнение создаёт расход в кассе
router.get('/vdf-orders', manager, vdfOrdersController.list);
router.get('/vdf-orders/pending-count', manager, vdfOrdersController.pendingCount);
router.patch('/vdf-orders/:id', manager, vdfOrdersController.updateAmount);
router.post('/vdf-orders/:id/execute', manager, vdfOrdersController.execute);

export default router;
