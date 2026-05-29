export interface INewsItem {
  _id?: string;
  title: string;
  summary: string;
  url: string;
  sourceName?: string;
  publishedAt: string;
  topicSlug: string;
  topicLabel: string;
  relatedProductIds?: string[];
  imageUrl?: string;
  fetchedAt: string;
  agentRunId?: string;
  isActive: boolean;
}

export interface INewsTopic {
  slug: string;
  label: string;
  fullPath: string;
}
