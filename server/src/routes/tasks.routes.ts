import { Router } from 'express';
import { tasksController } from '../controllers/tasks.controller';

// Задания — у всех сотрудников; кому можно поставить задание, проверяет сервис (assigneeRolesFor)
const router = Router();

router.get('/', tasksController.list);
router.get('/count', tasksController.mineCount);
router.get('/assignees', tasksController.assignees);
router.post('/', tasksController.create);
router.patch('/:id', tasksController.update);
router.post('/:id/done', tasksController.setDone);
router.delete('/:id', tasksController.delete);

export default router;
