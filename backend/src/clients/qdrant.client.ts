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
  const exists = collections.collections.some((c) => c.name === config.qdrant.collection);

  if (!exists) {
    await qdrant.createCollection(config.qdrant.collection, {
      vectors: { size: config.qdrant.vectorSize, distance: 'Cosine' },
    });
    console.log(`[qdrant] created collection ${config.qdrant.collection}`);
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
