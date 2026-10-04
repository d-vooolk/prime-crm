import { Router } from 'express';
import { stockController } from '../controllers/stock.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();

// Склад — в справочнике, который видят менеджеры и выше
router.use(requireRole(ROLES.MANAGER));

router.get('/categories', stockController.listCategories);
router.post('/categories', stockController.createCategory);
router.patch('/categories/:id', stockController.updateCategory);
router.delete('/categories/:id', stockController.deleteCategory);

router.get('/items', stockController.listItems);
router.get('/items/low-count', stockController.lowCount);
router.post('/items', stockController.createItem);
router.patch('/items/:id', stockController.updateItem);
router.delete('/items/:id', stockController.deleteItem);
router.post('/items/:id/movements', stockController.move);
router.get('/items/:id/movements', stockController.movements);

export default router;
