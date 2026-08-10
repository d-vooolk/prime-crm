import { Router, Request, Response } from 'express';
import { carsController } from '../controllers/cars.controller';
import { carsService } from '../services/cars.service';

const router = Router();

// Справочник авто из своей БД. Форма ответа совпадает со сторонним каталогом,
// из которого данные выкачаны (см. scripts/fetch-cars.ts).
router.get('/marks', carsController.getMarks);
router.get('/marks/:markId/models', carsController.getModels);
router.get('/marks/:markId/models/:modelId/generations', carsController.getGenerations);

// Прокси фото поколения: URL берём из своей БД, саму картинку тянем с CDN Яндекса.
// Прокси нужен, чтобы не светить внешние адреса в разметке и держать единый кэш.
router.get('/photo/:brandId/:modelId/:generationId', async (req: Request, res: Response) => {
  const { brandId, modelId, generationId } = req.params;

  try {
    const photo = await carsService.getGenerationPhoto(
      String(brandId),
      String(modelId),
      String(generationId),
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

export default router;
