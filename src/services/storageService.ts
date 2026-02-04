import type { CalendarEvent } from '../types';
import { LOCAL_STORAGE_KEY } from '../constants';

export const saveLocalEvents = (events: CalendarEvent[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
};

export const getLocalEvents = (): CalendarEvent[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load from local storage', e);
    return [];
  }
};

export const mergeEvents = (local: CalendarEvent[], remote: CalendarEvent[]): CalendarEvent[] => {
  // Strategy: Union of all events based on unique Date + Type key.
  const map = new Map<string, CalendarEvent>();
  
  // 1. Add remote events first
  remote.forEach(evt => {
    const key = `${evt.date}-${evt.type}`;
    map.set(key, evt);
  });
  
  // 2. Add/Overwrite with local events
  // Since our events are simple (date+type), overwriting is safe (same data).
  // This ensures that if we have a local event that isn't in remote yet, it gets added.
  local.forEach(evt => {
    const key = `${evt.date}-${evt.type}`;
    map.set(key, evt);
  });

  // 3. Convert back to array and sort chronologically
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};