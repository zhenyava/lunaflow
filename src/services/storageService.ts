import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { STORAGE_CURRENT_VERSION } from '../constants';
import * as idb from './indexedDBService';
import { migrations } from './migrationService';

export const parseAndMigrateData = (parsedData: unknown): { records: DailyRecord[], wasMigrated: boolean } => {
  if (!parsedData) return { records: [], wasMigrated: false };

  let currentVer = 1;
  let records: LegacyCalendarEvent[] | DailyRecord[];

  // 1. Determine version and extract records array
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && 'ver' in parsedData) {
    const dataObj = parsedData as Record<string, unknown>;
    currentVer = dataObj.ver as number;
    records = dataObj.records as DailyRecord[];
  } else if (Array.isArray(parsedData)) {
    currentVer = 1;
    records = parsedData as LegacyCalendarEvent[];
  } else {
    // Unknown or invalid format
    return { records: [], wasMigrated: false };
  }

  const initialVer = currentVer;

  // 2. Run migrations sequentially on the data array
  while (currentVer < STORAGE_CURRENT_VERSION && currentVer < migrations.length) {
    const migrateFn = migrations[currentVer];
    if (migrateFn) {
      // After the first migration (v1 -> v2), records will always be DailyRecord[]
      records = migrateFn(records) as DailyRecord[];
      currentVer++;
    } else {
      break;
    }
  }

  const wasMigrated = initialVer < currentVer;

  return {
    records: records as DailyRecord[],
    wasMigrated
  };
};

export const prepareDataForStorage = (records: DailyRecord[]) => {
   return { ver: STORAGE_CURRENT_VERSION, records };
};

export const getStoredEvents = async (): Promise<DailyRecord[]> => {
  try {
    const raw = await idb.readDailyRecords();
    if (!raw) return [];

    const { records, wasMigrated } = parseAndMigrateData(raw);
    if (wasMigrated) {
      await idb.writeDailyRecords(records);
    }
    return records;
  } catch (e) {
    console.error('Failed to load from IndexedDB', e);
    return [];
  }
};

export const saveStoredEvents = async (events: DailyRecord[]): Promise<void> => {
  try {
    await idb.writeDailyRecords(events);
  } catch (e) {
    console.error('Failed to save to IndexedDB', e);
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
