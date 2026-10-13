import { Router } from 'express';
import clientsRouter from './clients.routes';
import recordsRouter from './records.routes';
import servicesRouter from './services.routes';
import carsRouter from './cars.routes';
import authRouter from './auth.routes';
import accountingRouter from './accounting.routes';
import notesRouter from './notes.routes';
import wikiRouter from './wiki.routes';
import expensesRouter from './expenses.routes';
import stockRouter from './stock.routes';
import pushRouter from './push.routes';
import securityRouter from './security.routes';
import integrationsRouter from './integrations.routes';
import mailRouter from './mail.routes';
import cameraRouter from './camera.routes';
import cameraStreamRouter from './cameraStream.routes';
import siteLeadsRouter from './siteLeads.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use('/auth', authRouter);
router.use('/cars', carsRouter);
// Другие наши сайты — по общему ключу, без входа пользователя
router.use('/integrations', integrationsRouter);
// Видео и архив камеры — по токену просмотра в пути (routes/cameraStream.routes.ts)
router.use('/camera', cameraStreamRouter);

router.use(authMiddleware);

router.use('/clients', clientsRouter);
router.use('/records', recordsRouter);
router.use('/services', servicesRouter);
router.use('/accounting', accountingRouter);
router.use('/notes', notesRouter);
router.use('/wiki', wikiRouter);
router.use('/expenses', expensesRouter);
router.use('/stock', stockRouter);
router.use('/push', pushRouter);
router.use('/security', securityRouter);
router.use('/mail', mailRouter);
router.use('/camera', cameraRouter);
router.use('/site-leads', siteLeadsRouter);

export default router;
