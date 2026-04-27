export enum AIService {
  CODEX = 'Codex',
  CLAUDE_CODE = 'Claude Code',
  OPENCLAW = 'OpenClaw',
  HERMES = 'Hermes',
  OTHER = 'Other'
}

export interface Session {
  id?: number;
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  service: AIService;
  taskName?: string;
  description?: string;
  tags: string[];
}

export interface DailyStats {
  date: string;
  totalDuration: number;
  byService: Record<AIService, number>;
}

export type StartupStatus = 'NotStarted' | 'Starting' | 'Started' | 'Failed';

export interface StartupRecord {
  id?: number;
  timestamp: Date;
  durationMs: number;
  success: boolean;
  failureReason?: string;
  startedAt: Date;
  completedAt: Date;
  tags?: string[];
}
