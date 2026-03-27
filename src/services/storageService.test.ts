import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAndMigrateData, mergeEvents } from './storageService';
import { STORAGE_CURRENT_VERSION } from '../constants';
import { migrations } from './migrationService';
import type { DailyRecord, LegacyCalendarEvent } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

describe('storageService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Migration Pipeline Registry', () => {
    it('should have a registered migration for every version bump up to STORAGE_CURRENT_VERSION', () => {
      expect(migrations.length).toBe(STORAGE_CURRENT_VERSION);
    });
  });

  describe('parseAndMigrateData', () => {
    it('should migrate legacy events to DailyRecord format', () => {
      const legacyEvents: LegacyCalendarEvent[] = [
        { date: '2024-01-01', type: 'period' },
        { date: '2024-01-02', type: 'period' },
        { date: '2024-01-14', type: 'ovulation' },
      ];

      const { records, wasMigrated } = parseAndMigrateData(legacyEvents);

      expect(wasMigrated).toBe(true);
      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(makePeriodRecord('2024-01-01'));
      expect(records[1]).toEqual(makePeriodRecord('2024-01-02'));
      expect(records[2]).toEqual(makeOvulationRecord('2024-01-14'));
    });

    it('should return records from versioned storage format without migration', () => {
      const mockRecords: DailyRecord[] = [makePeriodRecord('2024-01-01')];
      const versionedData = { ver: 2, records: mockRecords };

      const { records, wasMigrated } = parseAndMigrateData(versionedData);

      expect(wasMigrated).toBe(false);
      expect(records).toEqual(mockRecords);
    });

    it('should return empty records for null/undefined input', () => {
      const { records, wasMigrated } = parseAndMigrateData(null);
      expect(records).toEqual([]);
      expect(wasMigrated).toBe(false);
    });

    it('should return empty records for invalid format', () => {
      const { records, wasMigrated } = parseAndMigrateData({ foo: 'bar' });
      expect(records).toEqual([]);
      expect(wasMigrated).toBe(false);
    });
  });

  describe('mergeEvents', () => {
    it('should prefer the record with the higher updatedAt', () => {
        const now = Date.now();
        const local: DailyRecord[] = [
            makePeriodRecord('2024-01-01', now), // Older
            makePeriodRecord('2024-01-02', now + 200), // Newer
        ];
        const remote: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: now + 100, isDeleted: true }, // Newer, user deleted
            makePeriodRecord('2024-01-02', now + 100), // Older
        ];

        const result = mergeEvents(local, remote);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ date: '2024-01-01', updatedAt: now + 100, isDeleted: true });
        expect(result[1]).toEqual(makePeriodRecord('2024-01-02', now + 200));
    });
  });
});
