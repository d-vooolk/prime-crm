import { Router } from 'express';
import { securityController } from '../controllers/security.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';
import { hiddenInLiteMode } from '../utils/liteMode';

const router = Router();

// Тревожная кнопка — Создатель, Директор, Менеджер (и мастер-доступ).
// После срабатывания (облегчённый режим) повторный запуск закрыт — 404, как и остальные скрытые разделы
router.post('/hidden-records', hiddenInLiteMode, requireRole(ROLES.MANAGER), securityController.hiddenRecords);

export default router;
