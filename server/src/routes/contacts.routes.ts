import { Router } from 'express';
import { contactsController } from '../controllers/contacts.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
router.use(requireRole(ROLES.MANAGER));

router.get('/', contactsController.list);
router.post('/', contactsController.create);
router.patch('/:id', contactsController.update);
router.delete('/:id', contactsController.delete);

export default router;
