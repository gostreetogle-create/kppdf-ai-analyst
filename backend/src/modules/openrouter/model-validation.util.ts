export type ModelField = 'embedModel' | 'chatModel' | 'curateModel';

export interface ModelValidationError {
  field: ModelField;
  message: string;
}

export interface ModelCatalogIds {
  chatIds: Set<string>;
  embedIds: Set<string>;
}

export function buildModelCatalogIds(catalog: {
  chat: Array<{ id: string }>;
  embed: Array<{ id: string }>;
}): ModelCatalogIds {
  return {
    chatIds: new Set(catalog.chat.map((m) => m.id)),
    embedIds: new Set(catalog.embed.map((m) => m.id)),
  };
}

export function validateModelsAgainstCatalog(
  models: { embedModel: string; chatModel: string; curateModel?: string },
  catalog: ModelCatalogIds,
): { valid: boolean; errors: ModelValidationError[] } {
  const errors: ModelValidationError[] = [];

  const embed = models.embedModel.trim();
  const chat = models.chatModel.trim();
  const curate = (models.curateModel?.trim() || chat).trim();

  validateEmbedModel(embed, catalog, errors);
  validateChatModel(chat, catalog, errors);

  if (curate !== chat) {
    validateChatModel(curate, catalog, errors, 'curateModel');
  }

  return { valid: errors.length === 0, errors };
}

function validateEmbedModel(
  modelId: string,
  catalog: ModelCatalogIds,
  errors: ModelValidationError[],
): void {
  if (!modelId) {
    errors.push({ field: 'embedModel', message: 'Укажите модель для эмбеддингов' });
    return;
  }

  if (catalog.embedIds.has(modelId)) {
    return;
  }

  if (catalog.chatIds.has(modelId)) {
    errors.push({
      field: 'embedModel',
      message: `Модель «${modelId}» предназначена для чата, а не для эмбеддингов. Выберите модель из списка эмбеддингов OpenRouter (например nvidia/llama-nemotron-embed-vl-1b-v2:free).`,
    });
    return;
  }

  errors.push({
    field: 'embedModel',
    message: `Модель «${modelId}» не найдена в каталоге эмбеддингов OpenRouter. Проверьте идентификатор (полный slug, включая :free для бесплатных).`,
  });
}

function validateChatModel(
  modelId: string,
  catalog: ModelCatalogIds,
  errors: ModelValidationError[],
  field: 'chatModel' | 'curateModel' = 'chatModel',
): void {
  if (!modelId) {
    errors.push({
      field,
      message: field === 'curateModel' ? 'Укажите модель курации' : 'Укажите чат-модель',
    });
    return;
  }

  if (catalog.chatIds.has(modelId)) {
    return;
  }

  if (catalog.embedIds.has(modelId)) {
    errors.push({
      field,
      message: `Модель «${modelId}» предназначена для эмбеддингов, а не для чата. Выберите модель из списка чата OpenRouter.`,
    });
    return;
  }

  errors.push({
    field,
    message: `Модель «${modelId}» не найдена в каталоге чата OpenRouter. Проверьте идентификатор (полный slug, включая :free для бесплатных).`,
  });
}
