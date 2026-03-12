import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

export type MigrationFunction = (data: unknown) => unknown;

/**
 * Migration from v1 (legacy array format) to v2 (DailyRecord schema).
 * Input: LegacyCalendarEvent[]
 * Output: DailyRecord[]
 */
const migrateV1ToV2 = (legacyEvents: LegacyCalendarEvent[]): DailyRecord[] => {
  const map = new Map<string, DailyRecord>();
  const now = Date.now();
  
  legacyEvents.forEach(event => {
    if (!map.has(event.date)) {
      map.set(
        event.date, 
        event.type === 'period' ? makePeriodRecord(event.date, now) : makeOvulationRecord(event.date, now)
      );
    }
  });
  
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Standard identity migration function for when the schema is backwards compatible 
 * and only the version number needs to be bumped.
 */
export const migrateVersionNumber = (records: DailyRecord[]): DailyRecord[] => {
  return records;
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 */
export const migrations: MigrationFunction[] = [
  (data) => data, // Index 0 (unused)
  migrateV1ToV2 as MigrationFunction,  // Index 1: v1 -> v2
];
