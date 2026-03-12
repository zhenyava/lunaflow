import type { DailyRecord } from '../types';
import { LOCAL_STORAGE_KEY, STORAGE_CURRENT_VERSION } from '../constants';
import { migrations } from './migrationService';

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

export const saveLocalEvents = (events: DailyRecord[]) => {
  try {
    const data = prepareDataForStorage(events);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
};

export const getLocalEvents = (): DailyRecord[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    const { records, wasMigrated } = parseAndMigrateData(parsed);

    if (wasMigrated) {
        saveLocalEvents(records);
    }

    return records;
  } catch (e) {
    console.error('Failed to load from local storage', e);
    return [];
  }
};

export const mergeEvents = (local: DailyRecord[], remote: DailyRecord[]): DailyRecord[] => {
  const map = new Map<string, DailyRecord>();
  
  const allRecords = [...local, ...remote];

  for (const record of allRecords) {
    const existing = map.get(record.date);
    
    // If the record doesn't exist yet, or the current one is newer
    if (!existing || record.updatedAt > existing.updatedAt) {
      map.set(record.date, record);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};
