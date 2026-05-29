import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupByUrl } from './rss-fetcher';

describe('dedupByUrl', () => {
  it('removes duplicate urls keeping first occurrence', () => {
    const items = [
      { url: 'https://a.example/1', title: 'A' },
      { url: 'https://b.example/2', title: 'B' },
      { url: 'https://a.example/1', title: 'A duplicate' },
    ];
    const result = dedupByUrl(items);
    assert.equal(result.length, 2);
    assert.equal(result[0]?.title, 'A');
    assert.equal(result[1]?.url, 'https://b.example/2');
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(dedupByUrl([]), []);
  });
});
