import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTopicRssFeedUrl, validateRssUrl, validateRssUrls } from './rss-url.util';

describe('buildTopicRssFeedUrl', () => {
  it('builds default Google News URL', () => {
    const url = buildTopicRssFeedUrl('Насосы', { useGoogleNewsRss: true, rssSearchTemplate: '' });
    assert.ok(url?.includes('news.google.com/rss/search'));
    assert.ok(url?.includes(encodeURIComponent('Насосы новости')));
  });

  it('returns null when Google News disabled', () => {
    assert.equal(
      buildTopicRssFeedUrl('Насосы', { useGoogleNewsRss: false, rssSearchTemplate: '' }),
      null,
    );
  });

  it('uses custom query template', () => {
    const url = buildTopicRssFeedUrl('Клапаны', {
      useGoogleNewsRss: true,
      rssSearchTemplate: '{label} промышленность',
    });
    assert.ok(url?.includes(encodeURIComponent('Клапаны промышленность')));
  });

  it('uses full feed URL template', () => {
    const url = buildTopicRssFeedUrl('Трубы', {
      useGoogleNewsRss: true,
      rssSearchTemplate: 'https://example.com/feed.xml',
    });
    assert.equal(url, 'https://example.com/feed.xml');
  });
});

describe('validateRssUrl', () => {
  it('accepts https feed', () => {
    assert.deepEqual(validateRssUrl('https://news.google.com/rss'), { ok: true });
  });

  it('rejects invalid and non-http protocols', () => {
    assert.equal(validateRssUrl('not-a-url').ok, false);
    assert.equal(validateRssUrl('ftp://x.com/feed').ok, false);
  });
});

describe('validateRssUrls', () => {
  it('aggregates errors', () => {
    const r = validateRssUrls(['https://a.ru/rss', 'bad']);
    assert.equal(r.valid, false);
    assert.ok(r.errors.length >= 1);
  });
});
