import { Router } from 'express';
import clientsRouter from './clients.routes';
import recordsRouter from './records.routes';
import servicesRouter from './services.routes';
import carsRouter from './cars.routes';
import authRouter from './auth.routes';
import accountingRouter from './accounting.routes';
import notesRouter from './notes.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use('/auth', authRouter);
router.use('/cars', carsRouter);

router.use(authMiddleware);

router.use('/clients', clientsRouter);
router.use('/records', recordsRouter);
router.use('/services', servicesRouter);
router.use('/accounting', accountingRouter);
router.use('/notes', notesRouter);

export default router;
