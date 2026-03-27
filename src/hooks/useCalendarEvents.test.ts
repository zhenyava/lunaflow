import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import * as storageService from '../services/storageService';
import type { DailyRecord } from '../types';
import { makePeriodRecord } from '../types';

// Mock the storage service
vi.mock('../services/storageService', () => ({
  getStoredEvents: vi.fn(),
  saveStoredEvents: vi.fn(),
}));

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with events from IndexedDB', async () => {
    const mockEvents: DailyRecord[] = [makePeriodRecord('2024-03-01')];
    vi.mocked(storageService.getStoredEvents).mockResolvedValue(mockEvents);

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.events).toEqual(mockEvents);
    });
    expect(result.current.allRecords).toEqual(mockEvents);
    expect(storageService.getStoredEvents).toHaveBeenCalledOnce();
  });

  it('should save to IndexedDB when events change', async () => {
    vi.mocked(storageService.getStoredEvents).mockResolvedValue([]);

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(storageService.getStoredEvents).toHaveBeenCalledOnce();
    });

    // Clear initial calls
    vi.mocked(storageService.saveStoredEvents).mockClear();

    act(() => {
      // Simulate adding an event
      result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
    });

    // saveStoredEvents should be called with the full record list
    expect(storageService.saveStoredEvents).toHaveBeenCalledWith([
      { date: '2024-03-01', updatedAt: Date.now(), isDeleted: false, period: {} }
    ]);
  });

  describe('handleDayClick logic', () => {
    it('should add a new event when date is empty', async () => {
      const existingRecord = makePeriodRecord('2024-03-01');
      vi.mocked(storageService.getStoredEvents).mockResolvedValue([existingRecord]);
      const { result } = renderHook(() => useCalendarEvents());

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      act(() => {
        result.current.setActiveType('ovulation');
      });

      act(() => {
        // Click on a new day
        result.current.handleDayClick(new Date('2024-03-05T12:00:00Z'));
      });

      const expected = [
        existingRecord,
        { date: '2024-03-05', updatedAt: Date.now(), isDeleted: false, ovulation: {} }
      ];
      expect(result.current.events).toEqual(expected);
      expect(result.current.allRecords).toEqual(expected);
    });

    it('should update event type when clicking existing date with different activeType', async () => {
      vi.mocked(storageService.getStoredEvents).mockResolvedValue([
        makePeriodRecord('2024-03-01')
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      act(() => {
        result.current.setActiveType('ovulation');
      });

      act(() => {
        // Click on existing day with different activeType
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      const expected = [
        { date: '2024-03-01', updatedAt: Date.now(), isDeleted: false, period: {}, ovulation: {} }
      ];
      expect(result.current.events).toEqual(expected);
      expect(result.current.allRecords).toEqual(expected);
    });

    it('should mark event as deleted and filter it from events when un-toggling', async () => {
      vi.mocked(storageService.getStoredEvents).mockResolvedValue([
        makePeriodRecord('2024-03-01')
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      act(() => {
        result.current.setActiveType('period');
      });

      act(() => {
        // Click on existing day with same activeType to toggle off
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      // UI 'events' should be empty
      expect(result.current.events).toEqual([]);

      // 'allRecords' should contain the tombstone
      expect(result.current.allRecords).toEqual([
        { date: '2024-03-01', updatedAt: Date.now(), isDeleted: true }
      ]);
    });
  });
});
