import { Schema, model, Document } from 'mongoose';

export type AgentRunType = 'sync' | 'news_refresh';
export type AgentRunStatus = 'running' | 'success' | 'failed';

export interface AgentRunDoc extends Document {
  type: AgentRunType;
  status: AgentRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  stats?: Record<string, unknown>;
  error?: string;
}

const agentRunSchema = new Schema<AgentRunDoc>(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true, default: () => new Date() },
    finishedAt: { type: Date },
    stats: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true },
);

export const AgentRunModel = model<AgentRunDoc>('AgentRun', agentRunSchema);
