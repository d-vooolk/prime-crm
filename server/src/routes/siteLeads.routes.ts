import { Router } from 'express';
import { siteLeadsController } from '../controllers/siteLeads.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();

// Заявки с сайта разбирают те же, кто создаёт записи, — менеджер и выше
const manager = requireRole(ROLES.MANAGER);

router.get('/', manager, siteLeadsController.list);
router.get('/count', manager, siteLeadsController.newCount);
router.post('/:id/done', manager, siteLeadsController.setDone);
router.post('/:id/record', manager, siteLeadsController.attachRecord);

export default router;
