import { v5 as uuidv5 } from 'uuid';

/** Stable Qdrant point id derived from KPPDF productId (idempotent upsert). */
const PRODUCT_POINT_NAMESPACE = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

export function productPointId(productId: string): string {
  return uuidv5(productId, PRODUCT_POINT_NAMESPACE);
}
