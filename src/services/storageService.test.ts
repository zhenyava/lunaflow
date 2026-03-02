import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalEvents, mergeEvents } from './storageService';
import { LOCAL_STORAGE_KEY } from '../constants';
import type { CalendarEvent } from '../types';

describe('storageService', () => {
  describe('getLocalEvents', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
      // Clear all mocks
      vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return parsed events when valid JSON data exists in localStorage', () => {
      const mockEvents: CalendarEvent[] = [
        { date: '2024-01-01', type: 'period' },
        { date: '2024-01-14', type: 'ovulation' }
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockEvents));

      const result = getLocalEvents();

      expect(result).toEqual(mockEvents);
    });

    it('should return an empty array when localStorage returns null (no data)', () => {
      const result = getLocalEvents();

      expect(result).toEqual([]);
    });

    it('should return an empty array and log error when JSON is invalid', () => {
      // Mock console.error to prevent it from cluttering test output and to assert it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      localStorage.setItem(LOCAL_STORAGE_KEY, '{ invalid_json ]');

      const result = getLocalEvents();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load from local storage', expect.any(SyntaxError));
    });

    it('should return an empty array and log error when localStorage.getItem throws an error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.getItem to throw an error (e.g. security error)
      const mockError = new Error('Access to localStorage denied');
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw mockError;
      });

      const result = getLocalEvents();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load from local storage', mockError);

      getItemSpy.mockRestore();
    });
  });

  describe('mergeEvents', () => {
    const createEvent = (date: string, type: 'period' | 'ovulation' = 'period'): CalendarEvent => ({
      date,
      type
    });

    it('should return empty array when merging empty arrays', () => {
      expect(mergeEvents([], [])).toEqual([]);
    });

    it('should return local events when remote is empty', () => {
      const local = [createEvent('2024-01-01')];
      expect(mergeEvents(local, [])).toEqual(local);
    });

    it('should return remote events when local is empty', () => {
      const remote = [createEvent('2024-01-01')];
      expect(mergeEvents([], remote)).toEqual(remote);
    });

    it('should merge completely different events', () => {
      const local = [createEvent('2024-01-01')];
      const remote = [createEvent('2024-01-05')];
      const expected = [createEvent('2024-01-01'), createEvent('2024-01-05')];
      expect(mergeEvents(local, remote)).toEqual(expected);
    });

    it('should deduplicate exact same events', () => {
      const local = [createEvent('2024-01-01')];
      const remote = [createEvent('2024-01-01')];
      expect(mergeEvents(local, remote)).toEqual([createEvent('2024-01-01')]);
    });

    it('should keep events with same date but different types', () => {
      const local = [createEvent('2024-01-01', 'period')];
      const remote = [createEvent('2024-01-01', 'ovulation')];

      const merged = mergeEvents(local, remote);

      expect(merged.length).toBe(2);
      expect(merged).toContainEqual(createEvent('2024-01-01', 'period'));
      expect(merged).toContainEqual(createEvent('2024-01-01', 'ovulation'));
    });

    it('should overwrite remote with local when keys match (object reference check)', () => {
      // This is important because local changes should take precedence over remote during sync.
      const remoteEvent = createEvent('2024-01-01');
      const localEvent = createEvent('2024-01-01');

      // Create new objects with an extra property to test reference/overwrite
      const remoteWithExtra = { ...remoteEvent, source: 'remote' } as unknown as CalendarEvent;
      const localWithExtra = { ...localEvent, source: 'local' } as unknown as CalendarEvent;

      const merged = mergeEvents([localWithExtra], [remoteWithExtra]);

      expect(merged.length).toBe(1);
      expect((merged[0] as unknown as { source: string }).source).toBe('local');
    });

    it('should sort the resulting array chronologically', () => {
      const local = [createEvent('2024-01-10'), createEvent('2024-01-05')];
      const remote = [createEvent('2024-01-15'), createEvent('2024-01-01')];

      const merged = mergeEvents(local, remote);

      expect(merged).toEqual([
        createEvent('2024-01-01'),
        createEvent('2024-01-05'),
        createEvent('2024-01-10'),
        createEvent('2024-01-15')
      ]);
    });
  });
});
