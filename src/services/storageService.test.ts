import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalEvents, mergeEvents } from './storageService';
import { LOCAL_STORAGE_KEY, STORAGE_CURRENT_VERSION } from '../constants';
import { migrations } from './migrationService';
import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

describe('storageService', () => {
  describe('Migration Pipeline Registry', () => {
    it('should have a registered migration for every version bump up to STORAGE_CURRENT_VERSION', () => {
      // Index 0 is a placeholder, so valid migrations start at index 1.
      // If STORAGE_CURRENT_VERSION is 2, migrations array should have 2 elements (0 and 1).
      // If STORAGE_CURRENT_VERSION is 3, migrations array should have 3 elements (0, 1, 2).
      expect(migrations.length).toBe(STORAGE_CURRENT_VERSION);
    });
  });

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

    it('should migrate legacy events to DailyRecord and wrap in version 2', () => {
      const legacyEvents: LegacyCalendarEvent[] = [
        { date: '2024-01-01', type: 'period' },
        { date: '2024-01-02', type: 'period' },
        { date: '2024-01-14', type: 'ovulation' },
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyEvents));

      const result = getLocalEvents();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(makePeriodRecord('2024-01-01'));
      expect(result[1]).toEqual(makePeriodRecord('2024-01-02'));
      expect(result[2]).toEqual(makeOvulationRecord('2024-01-14'));

      // Should have saved the migrated data in versioned format
      const savedRaw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      expect(savedRaw.ver).toBe(2);
      expect(savedRaw.records).toEqual(result);
    });

    it('should return records from versioned storage format', () => {
      const mockRecords: DailyRecord[] = [
        makePeriodRecord('2024-01-01')
      ];
      const versionedData = { ver: 2, records: mockRecords };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(versionedData));

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
            makePeriodRecord('2024-01-01', Date.now()), // Older
            makePeriodRecord('2024-01-02', Date.now() + 200), // Newer
        ];
        const remote: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: Date.now() + 100, isDeleted: true }, // Newer, user deleted
            makePeriodRecord('2024-01-02', Date.now() + 100), // Older
        ];

        const result = mergeEvents(local, remote);
        
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ date: '2024-01-01', updatedAt: Date.now() + 100, isDeleted: true });
        expect(result[1]).toEqual(makePeriodRecord('2024-01-02', Date.now() + 200));
    });
  });
});
