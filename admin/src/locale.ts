const RUN_TYPE: Record<string, string> = {
  sync: 'Синхронизация каталога',
  news_refresh: 'Обновление новостей',
};

const RUN_STATUS: Record<string, string> = {
  running: 'Выполняется',
  success: 'Успех',
  failed: 'Ошибка',
};

const MODEL_SOURCE: Record<string, string> = {
  db: 'база данных',
  env: '.env',
};

export function trRunType(type: string): string {
  return RUN_TYPE[type] ?? type;
}

export function trRunStatus(status: string): string {
  return RUN_STATUS[status] ?? status;
}

export function trModelSource(source: string): string {
  return MODEL_SOURCE[source] ?? source;
}
