import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { LOCAL_STORAGE_KEY } from '../constants';

const migrateToDailyRecords = (legacyEvents: LegacyCalendarEvent[]): DailyRecord[] => {
  const map = new Map<string, DailyRecord>();
  const now = Date.now();

  legacyEvents.forEach(event => {
    let record = map.get(event.date);
    if (!record) {
      record = {
        date: event.date,
        updatedAt: now,
      };
      map.set(event.date, record);
    }

    if (event.type === 'period') {
      record.period = {};
    } else if (event.type === 'ovulation') {
      record.ovulation = {};
    }
  });

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const saveLocalEvents = (events: DailyRecord[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
};

export const getLocalEvents = (): DailyRecord[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Check if it's legacy data
    if ('type' in parsed[0]) {
      const migrated = migrateToDailyRecords(parsed as LegacyCalendarEvent[]);
      saveLocalEvents(migrated); // Save the migrated data back immediately
      return migrated;
    }

    return parsed as DailyRecord[];
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
