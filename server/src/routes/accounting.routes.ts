import { Router } from 'express';
import { accountingController } from '../controllers/accounting.controller';

const router = Router();

router.get('/cash', accountingController.getCash);
router.get('/balance', accountingController.getBalance);
router.post('/expense', accountingController.createExpense);
router.post('/manual-income', accountingController.createManualIncome);
router.get('/capital', accountingController.getCapital);
router.get('/capital/balance', accountingController.getCapitalBalance);
router.post('/capital/deposit', accountingController.createDeposit);
router.post('/capital/withdrawal', accountingController.createWithdrawal);
router.get('/salary', accountingController.getSalary);
router.get('/salary/history', accountingController.getSalaryHistory);
router.patch('/cash/:id', accountingController.updateCashTransaction);
router.delete('/cash/:id', accountingController.deleteCashTransaction);
router.post('/salary-adjustments', accountingController.createAdjustment);
router.delete('/salary-adjustments/:id', accountingController.deleteAdjustment);
router.get('/founder-salaries', accountingController.getFounderSalaries);
router.post('/founder-salaries', accountingController.createFounderSalary);

export default router;
