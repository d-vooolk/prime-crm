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

export default router;
