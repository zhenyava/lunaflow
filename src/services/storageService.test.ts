import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalEvents } from './storageService';
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
});
