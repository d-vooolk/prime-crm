import { Router } from 'express';
import { clientsController } from '../controllers/clients.controller';

const router = Router();

router.get('/', clientsController.getAll);
router.get('/search', clientsController.searchByPhone);
router.get('/suggest', clientsController.suggest);
router.get('/:id', clientsController.getById);
router.post('/', clientsController.create);
router.patch('/:id', clientsController.update);

export default router;
