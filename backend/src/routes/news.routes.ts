import { Router } from 'express';
import { NewsItemModel } from '../models/newsItem.model';
import { refreshNews } from '../modules/news/news-analyst.service';
import { extractTopics } from '../modules/news/topic-extractor';

const router = Router();

router.get('/', async (req, res) => {
  const topic = req.query.topic as string | undefined;
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
  const filter: Record<string, unknown> = { isActive: true };
  if (topic) filter.topicSlug = topic;

  const items = await NewsItemModel.find(filter).sort({ publishedAt: -1 }).limit(limit);
  res.json({
    data: items.map((item) => ({
      _id: item._id,
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt.toISOString(),
      topicSlug: item.topicSlug,
      topicLabel: item.topicLabel,
      relatedProductIds: item.relatedProductIds,
      imageUrl: item.imageUrl,
      fetchedAt: item.fetchedAt.toISOString(),
      agentRunId: item.agentRunId,
      isActive: item.isActive,
    })),
  });
});

router.get('/topics', async (_req, res, next) => {
  try {
    const topics = await extractTopics();
    res.json({
      data: topics.map((t) => ({
        slug: t.slug,
        label: t.label,
        fullPath: t.fullPath,
        productCount: t.productCount,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (_req, res, next) => {
  try {
    const result = await refreshNews();
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already in progress')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
