import cron from 'node-cron';
import { config } from '../config';
import { syncCatalog } from '../modules/knowledge/indexer.service';
import { refreshNews } from '../modules/news/news-analyst.service';
import { AgentRunModel } from '../models/agentRun.model';

export interface JobRunResult {
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  stats?: Record<string, unknown>;
}

let syncInProgress = false;

export async function runSyncJob(trigger: 'startup' | 'cron' | 'manual'): Promise<JobRunResult> {
  if (syncInProgress) {
    console.warn('[scheduler] sync skipped — already running');
    return { status: 'skipped', error: 'Синхронизация уже выполняется' };
  }

  syncInProgress = true;
  const run = await AgentRunModel.create({
    type: 'sync',
    status: 'running',
    startedAt: new Date(),
    stats: { trigger },
  });

  try {
    console.log(`[scheduler] sync started (${trigger})`);
    const stats = await syncCatalog();
    run.status = 'success';
    run.finishedAt = new Date();
    run.stats = { ...stats, trigger };
    await run.save();
    console.log('[scheduler] sync finished', stats);
    return { status: 'success', stats: run.stats as Record<string, unknown> };
  } catch (err) {
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = err instanceof Error ? err.message : String(err);
    await run.save();
    console.error('[scheduler] sync failed', run.error);
    return { status: 'failed', error: run.error, stats: { trigger } };
  } finally {
    syncInProgress = false;
  }
}

export async function runNewsRefreshJob(trigger: 'cron' | 'manual'): Promise<JobRunResult> {
  try {
    console.log(`[scheduler] news refresh started (${trigger})`);
    const result = await refreshNews();
    return {
      status: 'success',
      stats: { trigger, ...result } as unknown as Record<string, unknown>,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already in progress')) {
      console.warn('[scheduler] news refresh skipped — already running');
      return {
        status: 'skipped',
        error: 'Обновление новостей уже выполняется — дождитесь завершения',
        stats: { trigger },
      };
    }
    console.error('[scheduler] news refresh failed', message);
    return { status: 'failed', error: message, stats: { trigger } };
  }
}

function hoursToCron(hours: number): string {
  const safe = Math.max(1, Math.min(hours, 168));
  if (safe >= 24 && safe % 24 === 0) {
    const days = safe / 24;
    return `0 0 */${days} * *`;
  }
  return `0 */${safe} * * *`;
}

export function startScheduler(): void {
  const syncCron = hoursToCron(config.schedule.syncIntervalHours);
  const newsCron = hoursToCron(config.schedule.newsRefreshIntervalHours);

  cron.schedule(syncCron, () => {
    void runSyncJob('cron');
  });

  cron.schedule(newsCron, () => {
    void runNewsRefreshJob('cron');
  });

  console.log(`[scheduler] sync cron: ${syncCron} (every ${config.schedule.syncIntervalHours}h)`);
  console.log(`[scheduler] news cron: ${newsCron} (every ${config.schedule.newsRefreshIntervalHours}h)`);

  void runSyncJob('startup');
}

export const scheduler = { startScheduler, runSyncJob, runNewsRefreshJob };
