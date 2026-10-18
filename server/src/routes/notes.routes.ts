import { Router } from 'express';
import { notesController } from '../controllers/notes.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
router.use(requireRole(ROLES.CREATOR));

router.get('/', notesController.getAll);
router.post('/', notesController.create);
router.patch('/:id', notesController.update);
router.delete('/:id', notesController.delete);

export default router;
