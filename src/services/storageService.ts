import type { DailyRecord } from '../types';
import { LOCAL_STORAGE_KEY, STORAGE_CURRENT_VERSION } from '../constants';
import { parseAndMigrateData, prepareDataForStorage } from './migrationService';

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
    const records = parseAndMigrateData(parsed);

    // Naive check: if it wasn't already in the exact current version format,
    // it means a migration happened (or it was empty), so we should auto-save the migrated state.
    const isFirstVersion = Array.isArray(parsed) && parsed.length > 0;
    if (isFirstVersion || (parsed && typeof parsed === 'object' && parsed.ver !== STORAGE_CURRENT_VERSION)) {
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
