import Dexie, { type Table } from 'dexie';
import { type Session } from '../types';

export class AgentFlowDB extends Dexie {
  sessions!: Table<Session>;

  constructor() {
    super('AgentFlowDB');
    this.version(1).stores({
      sessions: '++id, startTime, endTime, service, *tags'
    });
  }
}

export const db = new AgentFlowDB();
