import type { DailyRecord } from './DailyRecord';

/**
 * Versioned envelope that wraps user data for persistence and sync.
 */
export interface StorageEnvelope {
  ver: number;
  records: DailyRecord[];
}
