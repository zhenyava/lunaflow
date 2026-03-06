import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import * as storageService from '../services/storageService';
import type { DailyRecord } from '../types';

// Mock the storage service
vi.mock('../services/storageService', () => ({
  getLocalEvents: vi.fn(),
  saveLocalEvents: vi.fn(),
}));

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with events from local storage', () => {
    const mockEvents: DailyRecord[] = [{ date: '2024-03-01', updatedAt: 123, period: { isFlowing: true } }];
    vi.mocked(storageService.getLocalEvents).mockReturnValue(mockEvents);

    const { result } = renderHook(() => useCalendarEvents());

    expect(result.current.events).toEqual(mockEvents);
    expect(storageService.getLocalEvents).toHaveBeenCalledOnce();
  });

  it('should save to local storage when events change', () => {
    vi.mocked(storageService.getLocalEvents).mockReturnValue([]);

    const { result } = renderHook(() => useCalendarEvents());

    // Clear initial save from mount
    vi.mocked(storageService.saveLocalEvents).mockClear();

    act(() => {
      // Simulate adding an event
      result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
    });

    expect(storageService.saveLocalEvents).toHaveBeenCalledWith([
      { date: '2024-03-01', updatedAt: Date.now(), isDeleted: false, period: { isFlowing: true } }
    ]);
  });

  describe('handleDayClick logic', () => {
    it('should add a new event when date is empty', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', updatedAt: 100, period: { isFlowing: true } }
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      act(() => {
        result.current.setActiveType('ovulation');
      });

      act(() => {
        // Click on a new day
        result.current.handleDayClick(new Date('2024-03-05T12:00:00Z'));
      });

      expect(result.current.events).toEqual([
        { date: '2024-03-01', updatedAt: 100, period: { isFlowing: true } },
        { date: '2024-03-05', updatedAt: Date.now(), isDeleted: false, ovulation: { isConfirmed: true } }
      ]);
    });

    it('should update event type when clicking existing date with different activeType', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', updatedAt: 100, period: { isFlowing: true } }
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      act(() => {
        result.current.setActiveType('ovulation');
      });

      act(() => {
        // Click on existing day with different activeType
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      expect(result.current.events).toEqual([
        { date: '2024-03-01', updatedAt: Date.now(), isDeleted: false, period: { isFlowing: true }, ovulation: { isConfirmed: true } }
      ]);
    });

    it('should mark event as deleted when un-toggling the only active type', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', updatedAt: 100, period: { isFlowing: true } }
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      act(() => {
        // Defaults to 'period', but setting explicitly to be sure
        result.current.setActiveType('period');
      });

      act(() => {
        // Click on existing day with same activeType to toggle off
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      expect(result.current.events).toEqual([
        { date: '2024-03-01', updatedAt: Date.now(), isDeleted: true, period: { isFlowing: false } }
      ]);
    });
  });
});
