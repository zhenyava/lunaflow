import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

export type MigrationFunction = (data: unknown) => unknown;

/**
 * Migration from v1 (legacy array format) to v2 (versioned object format with DailyRecord schema).
 */
const migrateV1ToV2: MigrationFunction = (v1Data: unknown) => {
  const isLegacyFormat = Array.isArray(v1Data) && v1Data.length > 0 && 'type' in v1Data[0];
  
  if (isLegacyFormat) {
     const map = new Map<string, DailyRecord>();
     const now = Date.now();
     const legacyEvents = v1Data as LegacyCalendarEvent[];
     
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
  }
  
  return { ver: 2, records: Array.isArray(v1Data) ? v1Data : [] };
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 */
export const migrations: MigrationFunction[] = [
  (data) => data, // Index 0 (unused)
  migrateV1ToV2,  // Index 1: v1 -> v2
];
