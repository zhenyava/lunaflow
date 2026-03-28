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
export const parseStorageEnvelope = (data: unknown): { ver: number; records: DailyRecord[] } | null => {
  const result = v.safeParse(StorageEnvelopeSchema, data);
  if (!result.success) {
    console.warn('[LunaFlow] Invalid storage envelope:', result.issues);
    return null;
  }
  const { ver, records: rawRecords } = result.output;
  return { ver, records: validateDailyRecords(rawRecords) };
};
