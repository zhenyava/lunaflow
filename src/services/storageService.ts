import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { STORAGE_CURRENT_VERSION } from '../constants';
import { migrations } from './migrationService';

const DB_NAME = 'lunaflow';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const STORE_KEY = 'events';

/**
 * Opens (or creates) the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Central entry point for parsing and migrating raw data from any source.
 * It determines the current version of the data and runs it through the
 * migration pipeline sequentially until it reaches the STORAGE_CURRENT_VERSION.
 */
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

/**
 * Reads records from IndexedDB, running the migration pipeline if needed.
 */
export const getStoredEvents = async (): Promise<DailyRecord[]> => {
  try {
    const db = await openDB();
    const data = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(STORE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!data) return [];

    const { records, wasMigrated } = parseAndMigrateData(data);
    if (wasMigrated) {
      await saveStoredEvents(records);
    }
    return records;
  } catch (e) {
    console.error('Failed to load from IndexedDB', e);
    return [];
  }
};

/**
 * Writes records to IndexedDB as a versioned blob.
 */
export const saveStoredEvents = async (events: DailyRecord[]): Promise<void> => {
  try {
    const db = await openDB();
    const data = prepareDataForStorage(events);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, STORE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
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
