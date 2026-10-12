import { Router } from 'express';
import { cameraController } from '../controllers/camera.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
// Камеру офиса видят менеджер и выше (client/src/utils/roles.ts → canSeeCamera)
router.use(requireRole(ROLES.MANAGER));

router.get('/session', cameraController.session);
router.get('/archive', cameraController.archive);

export default router;
