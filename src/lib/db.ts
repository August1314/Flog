import Dexie, { type Table } from 'dexie';
import { type Session, type StartupRecord, type StartupStatus } from '../types';

export class AgentFlowDB extends Dexie {
  sessions!: Table<Session>;
  startupRecords!: Table<StartupRecord>;

  constructor() {
    super('AgentFlowDB');
    this.version(1).stores({
      sessions: '++id, startTime, endTime, service, *tags'
    });
    this.version(2).stores({
      sessions: '++id, startTime, endTime, service, *tags',
      startupRecords: '++id, timestamp, durationMs, success, *tags'
    });
  }
}

export const db = new AgentFlowDB();
