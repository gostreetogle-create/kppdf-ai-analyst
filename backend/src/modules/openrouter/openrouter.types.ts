export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CurateNewsInputItem {
  url: string;
  title: string;
  sourceName?: string;
  publishedAt?: string;
  snippet?: string;
  topicSlug: string;
  topicLabel: string;
  relatedProducts: Array<{ productId: string; name: string }>;
}

export interface CuratedNewsItem {
  url: string;
  title: string;
  summary: string;
  sourceName?: string;
  publishedAt?: string;
  topicSlug: string;
  topicLabel: string;
  relatedProductIds: string[];
}
