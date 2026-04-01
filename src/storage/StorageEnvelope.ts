import { DataMigrationService } from './DataMigrationService';
import type { DailyRecord } from './DailyRecord';
import { validateDailyRecords } from './DailyRecord';
import * as v from 'valibot';

/**
 * Versioned envelope that wraps user data for persistence and sync.
 */
export interface StorageEnvelope {
  ver: number;
  records: DailyRecord[];
}

/**
 * Checks if two envelopes are identical. 
 * 
 * NOTE: We only compare `date` and `updatedAt` for records because the application 
 * logic guarantees that any change to a record's content (symptoms, period, etc.) 
 * MUST be accompanied by a fresh `updatedAt` timestamp. This shallow comparison 
 * is highly efficient for the Sync Engine to detect changes without deep-parsing 
 * nested record objects.
 */
export const isEnvelopesEqual = (a: StorageEnvelope, b: StorageEnvelope): boolean => {
  if (a.ver !== b.ver) return false;
  if (a.records.length !== b.records.length) return false;
  for (let i = 0; i < a.records.length; i++) {
    if (a.records[i].date !== b.records[i].date) return false;
    if (a.records[i].updatedAt !== b.records[i].updatedAt) return false;
  }
  return true;
};

// --- Schema validation ---

const StorageEnvelopeSchema = v.object({
  ver: v.number(),
  records: v.array(v.unknown()),
});

/**
 * Two-phase validation: validates envelope shape, then each record individually.
 * Returns null if the envelope itself is malformed.
 * Invalid records within a valid envelope are dropped (not the whole dataset).
 */
export const parseStorageEnvelope = (data: unknown): StorageEnvelope | null => {
  const result = v.safeParse(StorageEnvelopeSchema, data);
  if (!result.success) {
    console.warn('[LunaFlow] Invalid storage envelope:', result.issues);
    return null;
  }
  const { ver, records: rawRecords } = result.output;
  return { ver, records: validateDailyRecords(rawRecords) };
};

export class EnvelopeMigrationService extends DataMigrationService<StorageEnvelope> {
  protected getVersion(data: StorageEnvelope): number {
    return data.ver;
  }

  protected setVersion(data: StorageEnvelope, version: number): StorageEnvelope {
    return { ...data, ver: version };
  }
}

