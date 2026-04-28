import { Router } from 'express';
import { notesController } from '../controllers/notes.controller';

const router = Router();

router.get('/', notesController.getAll);
router.post('/', notesController.create);
router.patch('/:id', notesController.update);
router.delete('/:id', notesController.delete);

export default router;
