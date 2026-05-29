import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModelCatalogIds,
  validateModelsAgainstCatalog,
} from './model-validation.util';

const catalog = buildModelCatalogIds({
  chat: [{ id: 'meta-llama/llama-3.3-70b-instruct:free' }, { id: 'qwen/qwen-2.5-7b-instruct' }],
  embed: [{ id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free' }],
});

describe('validateModelsAgainstCatalog', () => {
  it('accepts valid chat and embed models', () => {
    const result = validateModelsAgainstCatalog(
      {
        embedModel: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
        chatModel: 'meta-llama/llama-3.3-70b-instruct:free',
      },
      catalog,
    );
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects chat model used for embeddings', () => {
    const result = validateModelsAgainstCatalog(
      {
        embedModel: 'qwen/qwen-2.5-7b-instruct',
        chatModel: 'meta-llama/llama-3.3-70b-instruct:free',
      },
      catalog,
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.field, 'embedModel');
    assert.match(result.errors[0]?.message ?? '', /предназначена для чата/);
  });

  it('rejects unknown model ids', () => {
    const result = validateModelsAgainstCatalog(
      {
        embedModel: 'unknown/embed-model',
        chatModel: 'meta-llama/llama-3.3-70b-instruct:free',
      },
      catalog,
    );
    assert.equal(result.valid, false);
    assert.match(result.errors[0]?.message ?? '', /не найдена/);
  });

  it('validates curate model when different from chat', () => {
    const result = validateModelsAgainstCatalog(
      {
        embedModel: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
        chatModel: 'meta-llama/llama-3.3-70b-instruct:free',
        curateModel: 'unknown/chat-model',
      },
      catalog,
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.field, 'curateModel');
  });
});
