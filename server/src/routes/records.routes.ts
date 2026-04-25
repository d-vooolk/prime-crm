import { Router } from 'express';
import { recordsController } from '../controllers/records.controller';

const router = Router();

router.get('/', recordsController.getByDate);
router.get('/incomplete', recordsController.getIncomplete);
router.get('/companies', recordsController.searchCompanies);
router.get('/dates', recordsController.getDatesWithRecords);
router.get('/:id', recordsController.getById);
router.post('/', recordsController.create);
router.patch('/:id', recordsController.update);
router.post('/:id/close', recordsController.close);
router.post('/:id/cancel', recordsController.cancel);
router.post('/:id/restore', recordsController.restore);
router.post('/:id/send-sms', recordsController.sendSms);
router.patch('/:id/salary-date', recordsController.setSalaryDate);
router.delete('/:id', recordsController.delete);

export default router;
