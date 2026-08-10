import { Router, Request, Response } from 'express';
import { carsController } from '../controllers/cars.controller';
import { carsService } from '../services/cars.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// --- Чтение: публично, как и раньше (справочник не содержит данных клиентов) ---
// Форма ответа совпадает со сторонним каталогом, из которого данные выкачаны.
router.get('/marks', carsController.getMarks);
router.get('/marks/:markId/models', carsController.getModels);
router.get('/marks/:markId/models/:modelId/generations', carsController.getGenerations);

// Прокси фото поколения: URL берём из своей БД, саму картинку тянем с CDN Яндекса.
router.get('/photo/:brandId/:modelId/:generationId', async (req: Request, res: Response) => {
  const { brandId, modelId, generationId } = req.params;

  try {
    const photo = await carsService.getGenerationPhoto(
      String(brandId), String(modelId), String(generationId),
    );
    if (!photo) { res.status(404).end(); return; }

    const imgRes = await fetch(photo.startsWith('http') ? photo : `https://${photo}`);
    if (!imgRes.ok) { res.status(404).end(); return; }

    res.setHeader('content-type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.send(Buffer.from(await imgRes.arrayBuffer()));
  } catch {
    res.status(404).end();
  }
});

// --- Изменение: только для авторизованных, и только записи source=MANUAL ---
router.use(authMiddleware);

router.post('/marks', carsController.createMark);
router.patch('/marks/:markId', carsController.updateMark);
router.delete('/marks/:markId', carsController.deleteMark);

router.post('/marks/:markId/models', carsController.createModel);
router.patch('/marks/:markId/models/:modelId', carsController.updateModel);
router.delete('/marks/:markId/models/:modelId', carsController.deleteModel);

router.post('/marks/:markId/models/:modelId/generations', carsController.createGeneration);
router.patch('/marks/:markId/models/:modelId/generations/:generationId', carsController.updateGeneration);
router.delete('/marks/:markId/models/:modelId/generations/:generationId', carsController.deleteGeneration);

export default router;
