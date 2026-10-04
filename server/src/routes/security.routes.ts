import { Router } from 'express';
import { securityController } from '../controllers/security.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();

// Тревожная кнопка — Создатель, Директор, Менеджер (и мастер-доступ)
router.post('/hidden-records', requireRole(ROLES.MANAGER), securityController.hiddenRecords);

export default router;
