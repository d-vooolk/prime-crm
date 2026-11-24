import { Router } from 'express';
import { tasksController } from '../controllers/tasks.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
// Задания пока только у администратора (менеджера) и выше
router.use(requireRole(ROLES.MANAGER));

router.get('/', tasksController.list);
router.get('/count', tasksController.mineCount);
router.get('/assignees', tasksController.assignees);
router.post('/', tasksController.create);
router.post('/:id/done', tasksController.setDone);
router.delete('/:id', tasksController.delete);

export default router;
