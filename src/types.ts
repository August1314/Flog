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
