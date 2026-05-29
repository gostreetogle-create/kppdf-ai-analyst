import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterCuratedNewsItems } from './curate-filter.util';

describe('filterCuratedNewsItems', () => {
  const allowedUrls = new Set(['https://news.example/a']);
  const allowedProductIds = new Map([['https://news.example/a', new Set(['p1', 'p2'])]]);

  it('rejects urls not in allowed set', () => {
    const result = filterCuratedNewsItems(
      [
        {
          url: 'https://evil.example/x',
          title: 'Bad',
          summary: 'x',
          topicSlug: 't',
          topicLabel: 'T',
          relatedProductIds: ['p1'],
        },
      ],
      allowedUrls,
      allowedProductIds,
    );
    assert.equal(result.length, 0);
  });

  it('filters relatedProductIds to allowed product ids only', () => {
    const result = filterCuratedNewsItems(
      [
        {
          url: 'https://news.example/a',
          title: 'Ok',
          summary: 'Summary',
          topicSlug: 'pumps',
          topicLabel: 'Насосы',
          relatedProductIds: ['p1', 'p99'],
        },
      ],
      allowedUrls,
      allowedProductIds,
    );
    assert.equal(result.length, 1);
    assert.deepEqual(result[0]?.relatedProductIds, ['p1']);
  });

  it('requires title summary topic fields', () => {
    const result = filterCuratedNewsItems(
      [{ url: 'https://news.example/a', title: '', summary: 'x', topicSlug: 't', topicLabel: 'T' }],
      allowedUrls,
      allowedProductIds,
    );
    assert.equal(result.length, 0);
  });
});
