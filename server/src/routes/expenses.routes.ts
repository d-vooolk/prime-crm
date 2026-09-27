import { Router } from 'express';
import { expensesController } from '../controllers/expenses.controller';

const router = Router();

// Категории затрат для расходов кассы
router.get('/categories', expensesController.getCategories);
router.post('/categories', expensesController.createCategory);
router.patch('/categories/:id', expensesController.updateCategory);
router.delete('/categories/:id', expensesController.deleteCategory);

// Аналитика расходов (только создатель)
router.get('/analytics', expensesController.getAnalytics);

export default router;
