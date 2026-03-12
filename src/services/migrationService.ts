import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

export type MigrationFunction = (data: unknown) => unknown;

/**
 * Migration from v1 (legacy array format) to v2 (versioned object format with DailyRecord schema).
 * V1 is strictly defined as LegacyCalendarEvent[].
 */
const migrateV1ToV2 = (legacyEvents: LegacyCalendarEvent[]) => {
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
  
  return {
    ver: 2,
    records: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 */
export const migrations: MigrationFunction[] = [
  (data) => data, // Index 0 (unused)
  migrateV1ToV2 as MigrationFunction,  // Index 1: v1 -> v2
];
