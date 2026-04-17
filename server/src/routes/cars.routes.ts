import { Router, Request, Response } from 'express';

const router = Router();
const BASE_URL = 'https://auto-data.api-home.ru/api/public/v1';
const TOKEN = 'j8zmlGcAdsNnRn5pzDY3ZMfzDQGqSsE8lUpmv9Tej1GKoVq0cFW2ctD82NA7bmuT';

// In-memory cache: "brandId/modelId/generationId" -> photo URL
const photoUrlCache = new Map<string, string>();

router.get('/photo/:brandId/:modelId/:generationId', async (req: Request, res: Response) => {
  const { brandId, modelId, generationId } = req.params;
  const cacheKey = `${brandId}/${modelId}/${generationId}`;

  try {
    let photoUrl = photoUrlCache.get(cacheKey);

    if (!photoUrl) {
      const genRes = await fetch(
        `${BASE_URL}/marks/${brandId}/models/${modelId}/generations`,
        { headers: { 'api-token': TOKEN } }
      );
      if (!genRes.ok) { res.status(404).end(); return; }

      const data = await genRes.json() as { data: Array<{ id: number; photo?: string | null }> };
      const gen = data.data.find(g => String(g.id) === generationId);
      if (!gen?.photo) { res.status(404).end(); return; }

      photoUrl = `https://${gen.photo}`;
      photoUrlCache.set(cacheKey, photoUrl);
    }

    const imgRes = await fetch(photoUrl);
    if (!imgRes.ok) { res.status(404).end(); return; }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'public, max-age=86400');
    const buffer = await imgRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(404).end();
  }
});

export default router;
