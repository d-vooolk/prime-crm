import { Router } from 'express';
import { clientsController } from '../controllers/clients.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';
import { hiddenInLiteMode } from '../utils/liteMode';

const router = Router();
// Клиенты — от менеджера: сотрудникам контакты и история клиентов не показываются
const manager = requireRole(ROLES.MANAGER);

// Список клиентов (Настройки → Клиенты) в облегчённом режиме скрыт; поиск для записи работает
router.get('/', hiddenInLiteMode, manager, clientsController.getAll);
router.get('/search', manager, clientsController.searchByPhone);
router.get('/suggest', manager, clientsController.suggest);
router.get('/:id', manager, clientsController.getById);
router.post('/', manager, clientsController.create);
router.patch('/:id', manager, clientsController.update);

export default router;
