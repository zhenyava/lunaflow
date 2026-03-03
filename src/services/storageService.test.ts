import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveLocalEvents, getLocalEvents, mergeEvents } from './storageService';
import { LOCAL_STORAGE_KEY } from '../constants';
import type { CalendarEvent } from '../types';

describe('storageService', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.clearAllMocks();
  });

  describe('saveLocalEvents', () => {
    it('should save events to local storage', () => {
      const events: CalendarEvent[] = [
        { date: '2024-01-01', type: 'period' },
        { date: '2024-01-15', type: 'ovulation' },
      ];
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      saveLocalEvents(events);

      expect(setItemSpy).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(events));
    });

    it('should catch and log error if localStorage.setItem fails', () => {
      const events: CalendarEvent[] = [{ date: '2024-01-01', type: 'period' }];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      saveLocalEvents(events);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save to local storage', expect.any(Error));
    });
  });

  describe('getLocalEvents', () => {
    it('should return events from local storage', () => {
      const events: CalendarEvent[] = [{ date: '2024-01-01', type: 'period' }];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));

      const result = getLocalEvents();

      expect(result).toEqual(events);
    });

    it('should return an empty array if no events are in local storage', () => {
      const result = getLocalEvents();

      expect(result).toEqual([]);
    });

    it('should return an empty array and log error if localStorage.getItem fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      const result = getLocalEvents();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load from local storage', expect.any(Error));
    });

    it('should return an empty array and log error if JSON.parse fails', () => {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'invalid-json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getLocalEvents();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load from local storage', expect.any(Error));
    });
  });

  describe('mergeEvents', () => {
    it('should merge unique local and remote events', () => {
      const local: CalendarEvent[] = [{ date: '2024-01-01', type: 'period' }];
      const remote: CalendarEvent[] = [{ date: '2024-01-15', type: 'ovulation' }];

      const result = mergeEvents(local, remote);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(local[0]);
      expect(result).toContainEqual(remote[0]);
    });

    it('should overwrite remote events with local ones if they have the same date and type', () => {
      const remote: CalendarEvent[] = [{ date: '2024-01-01', type: 'period', note: 'remote' } as any];
      const local: CalendarEvent[] = [{ date: '2024-01-01', type: 'period', note: 'local' } as any];

      const result = mergeEvents(local, remote);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(local[0]);
    });

    it('should sort merged events chronologically', () => {
      const local: CalendarEvent[] = [{ date: '2024-01-15', type: 'period' }];
      const remote: CalendarEvent[] = [{ date: '2024-01-01', type: 'period' }];

      const result = mergeEvents(local, remote);

      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-15');
    });

    it('should handle empty local or remote arrays', () => {
      const events: CalendarEvent[] = [{ date: '2024-01-01', type: 'period' }];

      expect(mergeEvents([], events)).toEqual(events);
      expect(mergeEvents(events, [])).toEqual(events);
      expect(mergeEvents([], [])).toEqual([]);
    });
  });
});
