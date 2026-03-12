import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalEvents, mergeEvents } from './storageService';
import { LOCAL_STORAGE_KEY } from '../constants';
import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

describe('storageService', () => {
  describe('getLocalEvents & Migration', () => {
    beforeEach(() => {
      localStorage.clear();
      vi.restoreAllMocks();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should migrate legacy events to DailyRecord', () => {
      const legacyEvents: LegacyCalendarEvent[] = [
        { date: '2024-01-01', type: 'period' },
        { date: '2024-01-02', type: 'period' },
        { date: '2024-01-14', type: 'ovulation' },
        // Same day overlapping (which could theoretically happen if data got mangled)
        { date: '2024-01-15', type: 'period' },
        { date: '2024-01-15', type: 'ovulation' }
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyEvents));

      const result = getLocalEvents();

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(makePeriodRecord('2024-01-01'));
      expect(result[2]).toEqual(makeOvulationRecord('2024-01-14'));
      expect(result[3]).toEqual({
          date: '2024-01-15',
          updatedAt: Date.now(),
          period: {},
          ovulation: {}
      });

      // Should have saved the migrated data
      const savedData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      expect(savedData).toEqual(result);
    });

    it('should return parsed DailyRecord data directly', () => {
      const mockRecords: DailyRecord[] = [
        makePeriodRecord('2024-01-01', undefined, Date.now())
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockRecords));

      const result = getLocalEvents();

      expect(result).toEqual(mockRecords);
    });

    it('should return an empty array when localStorage returns null (no data)', () => {
      const result = getLocalEvents();
      expect(result).toEqual([]);
    });

    it('should return an empty array and log error when JSON is invalid', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem(LOCAL_STORAGE_KEY, '{ invalid_json ]');
      const result = getLocalEvents();
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load from local storage', expect.any(SyntaxError));
      consoleErrorSpy.mockRestore();
    });

    it('should return an empty array and log error when localStorage.getItem throws an error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockError = new Error('Access to localStorage denied');
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw mockError;
      });

      const result = getLocalEvents();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load from local storage', mockError);
      
      getItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('mergeEvents', () => {
    it('should prefer the record with the higher updatedAt', () => {
        const local: DailyRecord[] = [
            makePeriodRecord('2024-01-01', undefined, Date.now()), // Older
            makePeriodRecord('2024-01-02', undefined, Date.now() + 200), // Newer
        ];
        const remote: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: Date.now() + 100, isDeleted: true }, // Newer, user deleted
            makePeriodRecord('2024-01-02', undefined, Date.now() + 100), // Older
        ];

        const result = mergeEvents(local, remote);
        
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ date: '2024-01-01', updatedAt: Date.now() + 100, isDeleted: true });
        expect(result[1]).toEqual(makePeriodRecord('2024-01-02', undefined, Date.now() + 200));
    });
  });
});
