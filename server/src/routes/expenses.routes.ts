import { Router } from 'express';
import { expensesController } from '../controllers/expenses.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();

// Категории затрат для расходов кассы: читают все, правят все, кроме сотрудников
router.get('/categories', expensesController.getCategories);
router.post('/categories', requireRole(ROLES.MANAGER), expensesController.createCategory);
router.patch('/categories/:id', requireRole(ROLES.MANAGER), expensesController.updateCategory);
router.delete('/categories/:id', requireRole(ROLES.MANAGER), expensesController.deleteCategory);

// Аналитика расходов — только создатель
router.get('/analytics', requireRole(ROLES.CREATOR), expensesController.getAnalytics);

export default router;
