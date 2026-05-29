import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTopicsFromCatalog, buildTopicsFromSheetRows } from './topic-build.util';

describe('buildTopicsFromCatalog', () => {
  it('returns top categories by product count', () => {
    const categories = [
      { _id: 'c1', name: 'Насосы', fullPath: '/equipment/pumps' },
      { _id: 'c2', name: 'Клапаны', fullPath: '/equipment/valves' },
    ];
    const products = [
      { _id: 'p1', name: 'P1', categoryId: 'c1' },
      { _id: 'p2', name: 'P2', categoryId: 'c1' },
      { _id: 'p3', name: 'P3', categoryId: 'c1' },
      { _id: 'p4', name: 'P4', categoryId: 'c2' },
    ];

    const topics = buildTopicsFromCatalog(products, categories, 15);
    assert.equal(topics.length, 2);
    assert.equal(topics[0]?.label, 'Насосы');
    assert.equal(topics[0]?.productCount, 3);
    assert.equal(topics[0]?.slug, 'equipment-pumps');
  });

  it('respects limit', () => {
    const categories = [
      { _id: 'c1', name: 'A', fullPath: '/a' },
      { _id: 'c2', name: 'B', fullPath: '/b' },
    ];
    const products = [
      { _id: 'p1', name: 'A1', categoryId: 'c1' },
      { _id: 'p2', name: 'B1', categoryId: 'c2' },
      { _id: 'p3', name: 'B2', categoryId: 'c2' },
    ];

    const topics = buildTopicsFromCatalog(products, categories, 1);
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.label, 'B');
  });
});

describe('buildTopicsFromSheetRows', () => {
  it('groups by category and subcategory', () => {
    const rows = [
      { sku: 'A1', name: 'Ball', category: 'Спорт', subcategory: 'Мячи', raw: {} },
      { sku: 'A2', name: 'Ball 2', category: 'Спорт', subcategory: 'Мячи', raw: {} },
      { sku: 'B1', name: 'Mat', category: 'Спорт', subcategory: 'Коврики', raw: {} },
    ];

    const topics = buildTopicsFromSheetRows(rows, 15);
    assert.equal(topics.length, 2);
    assert.equal(topics[0]?.label, 'Мячи');
    assert.equal(topics[0]?.productCount, 2);
  });
});
