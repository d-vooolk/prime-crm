import { Router } from 'express';
import { recordsController } from '../controllers/records.controller';

const router = Router();

router.get('/', recordsController.getByDate);
router.get('/incomplete', recordsController.getIncomplete);
router.get('/:id', recordsController.getById);
router.post('/', recordsController.create);
router.patch('/:id', recordsController.update);
router.post('/:id/close', recordsController.close);
router.post('/:id/cancel', recordsController.cancel);
router.post('/:id/restore', recordsController.restore);

export default router;
