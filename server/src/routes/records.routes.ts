import { Router } from 'express';
import { recordsController } from '../controllers/records.controller';
import { recordMediaController } from '../controllers/recordMedia.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';
import { RECORD_MEDIA_DIR } from '../utils/uploads';
import { mediaUpload } from '../utils/mediaUpload';

const router = Router();
// Расписание видят все; создают, правят и закрывают записи — от менеджера, удаляет — создатель
const manager = requireRole(ROLES.MANAGER);

const uploadMedia = mediaUpload({ dir: RECORD_MEDIA_DIR, maxPhotoMb: 40, maxVideoMb: 300 });

router.get('/', recordsController.getByDate);
router.get('/incomplete', recordsController.getIncomplete);
router.get('/closed-on', recordsController.getClosedOnDate);
router.get('/companies', manager, recordsController.searchCompanies);
router.get('/dates', recordsController.getDatesWithRecords);
router.get('/:id', recordsController.getById);
router.post('/', manager, recordsController.create);
router.patch('/:id', manager, recordsController.update);
router.post('/:id/close', manager, recordsController.close);
router.post('/:id/cancel', manager, recordsController.cancel);
router.post('/:id/restore', manager, recordsController.restore);
router.post('/:id/send-sms', manager, recordsController.sendSms);
router.patch('/:id/salary-date', manager, recordsController.setSalaryDate);
router.delete('/:id', requireRole(ROLES.CREATOR), recordsController.delete);

// Обнаруженные недостатки, фото и видео нюансов авто — добавляет любая роль
router.patch('/:id/defects', recordsController.setDefects);
router.get('/:id/media', recordMediaController.list);
router.post('/:id/media', uploadMedia, recordMediaController.upload);
router.delete('/:id/media/:mediaId', recordMediaController.delete);

export default router;
