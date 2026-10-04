import { Router } from 'express';
import { wikiController } from '../controllers/wiki.controller';
import { WIKI_MEDIA_DIR } from '../utils/uploads';
import { mediaUpload } from '../utils/mediaUpload';

// Видео с телефона бывают тяжёлыми, фото — нет
const uploadMedia = mediaUpload({ dir: WIKI_MEDIA_DIR, maxPhotoMb: 40, maxVideoMb: 300 });

const router = Router();

router.get('/entries', wikiController.listEntries);
router.get('/entry', wikiController.getEntry);
router.put('/entry', wikiController.saveContent);
router.post('/media', uploadMedia, wikiController.uploadMedia);
router.delete('/media/:id', wikiController.deleteMedia);

router.get('/revisions', wikiController.listRevisions);
router.get('/revisions/pending-count', wikiController.pendingCount);
router.post('/revisions/:id/review', wikiController.markReviewed);
router.post('/revisions/:id/reward', wikiController.reward);

router.get('/settings', wikiController.getSettings);
router.patch('/settings', wikiController.updateSettings);

export default router;
