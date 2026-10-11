import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller';
import { equipmentController } from '../controllers/equipment.controller';
import { clientSourcesController } from '../controllers/clientSources.controller';
import { servicemenController } from '../controllers/servicemen.controller';
import { settingsController, smsSettingsController, documentTemplateController } from '../controllers/settings.controller';
import { analyticsController } from '../controllers/analytics.controller';
import { repairTypesController } from '../controllers/repairTypes.controller';
import { mediaUpload } from '../utils/mediaUpload';
import { REPAIR_TYPE_MEDIA_DIR } from '../utils/uploads';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';

const router = Router();
// Справочники читают все (нужны для записей и печати), меняют — от менеджера
const manager = requireRole(ROLES.MANAGER);

// Настройки компании
router.get('/settings', settingsController.get);
router.patch('/settings', manager, settingsController.update);

// SMS настройки
router.get('/sms-settings', manager, smsSettingsController.get);
router.patch('/sms-settings', manager, smsSettingsController.update);
router.get('/sms-settings/check', manager, smsSettingsController.check);
router.post('/sms-settings/test', manager, smsSettingsController.test);

// Шаблоны документов
router.get('/doc-templates', documentTemplateController.getAll);
router.post('/doc-templates', manager, documentTemplateController.create);
router.patch('/doc-templates/:id', manager, documentTemplateController.update);
router.delete('/doc-templates/:id', manager, documentTemplateController.delete);

// Аналитика (дашборд скрыт от сотрудников; выручку на нём видят директора — данные нужны графикам)
router.get('/analytics/summary', manager, analyticsController.getSummary);
router.get('/analytics/revenue', requireRole(ROLES.DIRECTOR), analyticsController.getRevenue);
router.get('/analytics/top-services', manager, analyticsController.getTopServices);
router.get('/analytics/sources', manager, analyticsController.getSources);

// Оборудование
router.get('/equipment', equipmentController.getAll);
router.post('/equipment', manager, equipmentController.create);
router.patch('/equipment/:id', manager, equipmentController.update);
router.delete('/equipment/:id', manager, equipmentController.delete);

// Источники клиента (поле записи, статистика каналов на дашборде)
router.get('/client-sources', clientSourcesController.getAll);
router.post('/client-sources', manager, clientSourcesController.create);
router.patch('/client-sources/:id', manager, clientSourcesController.update);
router.post('/client-sources/:id/move', manager, clientSourcesController.move);
router.delete('/client-sources/:id', manager, clientSourcesController.delete);

// Сотрудники (менять можно только своих и младших по роли — проверка в сервисе)
router.get('/servicemen/today-birthdays', servicemenController.getTodayBirthdays);
router.get('/servicemen', servicemenController.getAll);
router.get('/servicemen/all', servicemenController.getAllIncludingDismissed);
router.post('/servicemen', manager, servicemenController.create);
router.patch('/servicemen/:id', manager, servicemenController.update);
router.post('/servicemen/:id/dismiss', manager, servicemenController.dismiss);
router.post('/servicemen/:id/restore', manager, servicemenController.restore);
router.post('/servicemen/:id/set-default', manager, servicemenController.setDefault);
router.delete('/servicemen/:id', manager, servicemenController.delete);

// Категории
router.get('/categories', catalogController.listCategories);
router.post('/categories', manager, catalogController.createCategory);
router.patch('/categories/:id', manager, catalogController.updateCategory);
router.delete('/categories/:id', manager, catalogController.deleteCategory);

// Типы ремонта — блоки страницы записи для клиента (описание, фото, вопросы и ответы)
const uploadRepairTypePhoto = mediaUpload({ dir: REPAIR_TYPE_MEDIA_DIR, maxPhotoMb: 40, maxVideoMb: 40 });
router.get('/repair-types', repairTypesController.list);
router.post('/repair-types', manager, repairTypesController.create);
router.patch('/repair-types/:id', manager, repairTypesController.update);
router.delete('/repair-types/:id', manager, repairTypesController.delete);
router.post('/repair-types/:id/photos', manager, uploadRepairTypePhoto, repairTypesController.addPhoto);
router.delete('/repair-types/:id/photos/:photoId', manager, repairTypesController.deletePhoto);

// Услуги, исключённые из «Открытых возможностей» карточки записи
router.put('/opportunity-exclusions', manager, catalogController.setOpportunityExclusions);

// Услуги (динамический /:id — последним)
router.post('/', manager, catalogController.createService);
router.patch('/:id', manager, catalogController.updateService);
router.delete('/:id', manager, catalogController.deleteService);

export default router;
