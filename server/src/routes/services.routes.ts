import { Router } from 'express';
import {
  servicesController,
  equipmentController,
  servicemanController,
  settingsController,
  smsSettingsController,
  documentTemplateController,
  analyticsController,
} from '../controllers/services.controller';

const router = Router();

// Настройки компании
router.get('/settings', settingsController.get);
router.patch('/settings', settingsController.update);

// SMS настройки
router.get('/sms-settings', smsSettingsController.get);
router.patch('/sms-settings', smsSettingsController.update);

// Шаблоны документов
router.get('/doc-templates', documentTemplateController.getAll);
router.post('/doc-templates', documentTemplateController.create);
router.patch('/doc-templates/:id', documentTemplateController.update);
router.delete('/doc-templates/:id', documentTemplateController.delete);

// Аналитика
router.get('/analytics/summary', analyticsController.getSummary);
router.get('/analytics/revenue', analyticsController.getRevenue);
router.get('/analytics/top-services', analyticsController.getTopServices);

// Оборудование
router.get('/equipment', equipmentController.getAll);
router.post('/equipment', equipmentController.create);
router.patch('/equipment/:id', equipmentController.update);
router.delete('/equipment/:id', equipmentController.delete);

// Сотрудники
router.get('/servicemen', servicemanController.getAll);
router.get('/servicemen/all', servicemanController.getAllIncludingDismissed);
router.post('/servicemen', servicemanController.create);
router.patch('/servicemen/:id', servicemanController.update);
router.post('/servicemen/:id/dismiss', servicemanController.dismiss);
router.post('/servicemen/:id/set-default', servicemanController.setDefault);
router.delete('/servicemen/:id', servicemanController.delete);

// Категории
router.get('/categories', servicesController.getAll);
router.post('/categories', servicesController.createCategory);
router.patch('/categories/:id', servicesController.updateCategory);
router.delete('/categories/:id', servicesController.deleteCategory);

// Услуги (динамический /:id — последним)
router.post('/', servicesController.createService);
router.patch('/:id', servicesController.updateService);
router.delete('/:id', servicesController.deleteService);

export default router;
