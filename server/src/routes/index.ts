import { Router } from 'express';
import clientsRouter from './clients.routes';
import recordsRouter from './records.routes';
import servicesRouter from './services.routes';

const router = Router();

router.use('/clients', clientsRouter);
router.use('/records', recordsRouter);
router.use('/services', servicesRouter);

export default router;
