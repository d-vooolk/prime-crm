import { Router } from 'express';
import clientsRouter from './clients.routes';
import recordsRouter from './records.routes';
import servicesRouter from './services.routes';
import carsRouter from './cars.routes';

const router = Router();

router.use('/clients', clientsRouter);
router.use('/records', recordsRouter);
router.use('/services', servicesRouter);
router.use('/cars', carsRouter);

export default router;
