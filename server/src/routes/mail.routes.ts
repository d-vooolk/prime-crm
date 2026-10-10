import { Router } from 'express';
import { mailController } from '../controllers/mail.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
// Почту компании видит только создатель (и мастер-доступ)
router.use(requireRole(ROLES.CREATOR));

router.get('/', mailController.list);
router.get('/unread-count', mailController.unreadCount);
router.get('/status', mailController.status);
router.post('/sync', mailController.sync);
router.post('/read-all', mailController.markAllRead);
router.get('/attachments/:id', mailController.attachment);
router.get('/:id', mailController.get);
router.patch('/:id', mailController.setRead);
router.delete('/:id', mailController.delete);

export default router;
