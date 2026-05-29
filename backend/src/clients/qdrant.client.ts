import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: config.qdrant.url });
  }
  return client;
}

export async function ensureCollection(): Promise<void> {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  let exists = collections.collections.some((c) => c.name === config.qdrant.collection);

  if (exists) {
    const info = await qdrant.getCollection(config.qdrant.collection);
    const vectors = info.config?.params?.vectors;
    const currentSize =
      typeof vectors === 'object' && vectors && 'size' in vectors
        ? Number(vectors.size)
        : undefined;

    if (currentSize != null && currentSize !== config.qdrant.vectorSize) {
      const { count = 0 } = await qdrant.count(config.qdrant.collection, { exact: true });
      if (count > 0) {
        throw new Error(
          `[qdrant] vector size mismatch: collection=${currentSize}, QDRANT_VECTOR_SIZE=${config.qdrant.vectorSize} (${count} points). ` +
            'Удалите коллекцию или выставьте QDRANT_VECTOR_SIZE под embed-модель.',
        );
      }
      console.warn(
        `[qdrant] recreating ${config.qdrant.collection}: vector size ${currentSize} → ${config.qdrant.vectorSize}`,
      );
      await qdrant.deleteCollection(config.qdrant.collection);
      exists = false;
    }
  }

  if (!exists) {
    await qdrant.createCollection(config.qdrant.collection, {
      vectors: { size: config.qdrant.vectorSize, distance: 'Cosine' },
    });
    console.log(`[qdrant] created collection ${config.qdrant.collection} (dim=${config.qdrant.vectorSize})`);
  }
}

export async function qdrantHealth(): Promise<boolean> {
  try {
    await getQdrantClient().getCollections();
    return true;
  } catch {
    return false;
  }
}
