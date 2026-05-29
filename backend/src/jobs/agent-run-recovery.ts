import { AgentRunModel } from '../models/agentRun.model';

const DEFAULT_STALE_MINUTES = 15;

/** Помечает зависшие AgentRun (running без finishedAt) как failed после рестарта или таймаута. */
export async function recoverStaleAgentRuns(
  maxAgeMinutes = DEFAULT_STALE_MINUTES,
): Promise<number> {
  const filter: Record<string, unknown> = { status: 'running' };
  if (maxAgeMinutes > 0) {
    filter.startedAt = { $lt: new Date(Date.now() - maxAgeMinutes * 60 * 1000) };
  }

  const result = await AgentRunModel.updateMany(filter, {
    $set: {
      status: 'failed',
      finishedAt: new Date(),
      error: 'Stale run (server restart or timeout)',
    },
  });

  const count = result.modifiedCount ?? 0;
  if (count > 0) {
    console.log(`[runs] recovered ${count} stale agent run(s)`);
  }
  return count;
}

export async function countRunningNewsRefresh(): Promise<number> {
  return AgentRunModel.countDocuments({ type: 'news_refresh', status: 'running' }).exec();
}
