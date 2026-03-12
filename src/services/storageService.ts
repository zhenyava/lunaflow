import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { LOCAL_STORAGE_KEY, STORAGE_CURRENT_VERSION } from '../constants';
import { makePeriodRecord, makeOvulationRecord } from '../types';

const migrateToDailyRecords = (legacyEvents: LegacyCalendarEvent[]): DailyRecord[] => {
  const map = new Map<string, DailyRecord>();
  const now = Date.now();

  legacyEvents.forEach(event => {
    let record = map.get(event.date);
    
    if (!record) {
      if (event.type === 'period') {
        record = makePeriodRecord(event.date, now);
      } else {
        record = makeOvulationRecord(event.date, now);
      }
      map.set(event.date, record);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const saveLocalEvents = (events: DailyRecord[]) => {
  try {
    const data = { ver: STORAGE_CURRENT_VERSION, records: events };
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
    
    // 1. Check if it's the NEW versioned format
    if (parsed && typeof parsed === 'object' && parsed.ver === STORAGE_CURRENT_VERSION && Array.isArray(parsed.records)) {
      return parsed.records as DailyRecord[];
    }

    // 2. Handle intermediate or legacy array formats
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Is it the legacy format [ { date, type }, ... ]?
      if ('type' in parsed[0]) {
        const migrated = migrateToDailyRecords(parsed as LegacyCalendarEvent[]);
        saveLocalEvents(migrated); // Auto-migrate to versioned format
        return migrated;
      }
      // Or just a raw array [ DailyRecord, ... ]?
      const migrated = parsed as DailyRecord[];
      saveLocalEvents(migrated); // Auto-migrate to versioned format
      return migrated;
    }

    return [];
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
