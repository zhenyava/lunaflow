import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { STORAGE_CURRENT_VERSION } from '../constants';
import { makePeriodRecord, makeOvulationRecord } from '../types';

type MigrationFunction = (data: unknown) => unknown;

/**
 * Migration from v1 (legacy array format) to v2 (versioned object format with DailyRecord schema).
 * 
 * In v1, data was stored directly as an array. It could be either:
 * A) The original legacy format: [{ date: '2024-01-01', type: 'period' }, ...]
 * B) An intermediate format: [{ date: '2024-01-01', period: {}, updatedAt: 123 }, ...]
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
  
  // If it's already an array of DailyRecords (intermediate state), just wrap it
  return { ver: 2, records: Array.isArray(v1Data) ? v1Data : [] };
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 * Index 0 is a placeholder since versions start at 1.
 * Index 1 handles the migration from v1 to v2.
 */
const migrations: MigrationFunction[] = [
  (data) => data, // Index 0 (unused)
  migrateV1ToV2,  // Index 1: v1 -> v2
];

/**
 * Central entry point for parsing and migrating raw data from any source.
 * It determines the current version of the data and runs it through the
 * migration pipeline sequentially until it reaches the STORAGE_CURRENT_VERSION.
 */
export const parseAndMigrateData = (parsedData: unknown): { records: DailyRecord[], wasMigrated: boolean } => {
  if (!parsedData) return { records: [], wasMigrated: false };

  // Determine current version of the data
  // Legacy arrays are considered v1.
  let currentVer = 1;
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && 'ver' in parsedData) {
    currentVer = (parsedData as Record<string, unknown>).ver as number;
  }

  const initialVer = currentVer;
  let migratedData: unknown = parsedData;

  // Run migrations sequentially
  while (currentVer < STORAGE_CURRENT_VERSION && currentVer < migrations.length) {
    const migrateFn = migrations[currentVer];
    if (migrateFn) {
      migratedData = migrateFn(migratedData);
      currentVer++;
    } else {
       // Failsafe if a migration step is missing
       break; 
    }
  }

  const wasMigrated = initialVer < currentVer;

  // Final validation to ensure the output matches the expected standard format
  const finalData = migratedData as Record<string, unknown>;
  if (
      finalData && 
      typeof finalData === 'object' && 
      finalData.ver === STORAGE_CURRENT_VERSION && 
      Array.isArray(finalData.records)
  ) {
       return { records: finalData.records as DailyRecord[], wasMigrated };
  }

  return { records: [], wasMigrated: false };
};

/**
 * Helper to wrap standard DailyRecord array into the versioned storage envelope.
 */
export const prepareDataForStorage = (records: DailyRecord[]) => {
   return { ver: STORAGE_CURRENT_VERSION, records };
};
