import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import * as storageService from '../services/storageService';
import type { CalendarEvent } from '../types';

// Mock the storage service
vi.mock('../services/storageService', () => ({
  getLocalEvents: vi.fn(),
  saveLocalEvents: vi.fn(),
}));

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with events from local storage', () => {
    const mockEvents: CalendarEvent[] = [{ date: '2024-03-01', type: 'period' }];
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
      { date: '2024-03-01', type: 'period' }
    ]);
  });

  describe('handleDayClick logic', () => {
    it('should add a new event when date is empty', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', type: 'period' }
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
        { date: '2024-03-01', type: 'period' },
        { date: '2024-03-05', type: 'ovulation' }
      ]);
    });

    it('should update event type when clicking existing date with different activeType', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', type: 'period' }
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
        { date: '2024-03-01', type: 'ovulation' }
      ]);
    });

    it('should remove the event when clicking existing date with the same activeType', () => {
      vi.mocked(storageService.getLocalEvents).mockReturnValue([
        { date: '2024-03-01', type: 'period' },
        { date: '2024-03-02', type: 'period' }
      ]);
      const { result } = renderHook(() => useCalendarEvents());

      act(() => {
        // Defaults to 'period', but setting explicitly to be sure
        result.current.setActiveType('period');
      });

      act(() => {
        // Click on existing day with same activeType
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      expect(result.current.events).toEqual([
        { date: '2024-03-02', type: 'period' }
      ]);
    });

    it('should only update/remove a single matching event, preserving others on the same date if they existed', () => {
      // It's a rare case, but testing object identity behavior
      const sharedDate = '2024-03-01';
      const event1: CalendarEvent = { date: sharedDate, type: 'period' };
      const event2: CalendarEvent = { date: sharedDate, type: 'ovulation' };

      vi.mocked(storageService.getLocalEvents).mockReturnValue([event1, event2]);
      const { result } = renderHook(() => useCalendarEvents());

      act(() => {
        result.current.setActiveType('period');
      });

      act(() => {
        // Click day: activeType 'period' matches event1 type.
        // It should REMOVE event1, and LEAVE event2 untouched.
        result.current.handleDayClick(new Date(`${sharedDate}T12:00:00Z`));
      });

      expect(result.current.events).toEqual([event2]);

      // Now update type
      act(() => {
        result.current.setActiveType('period');
      });

      act(() => {
        // Click day: activeType 'period' DOES NOT match event2 type ('ovulation').
        // It should UPDATE event2 type to 'period'.
        result.current.handleDayClick(new Date(`${sharedDate}T12:00:00Z`));
      });

      expect(result.current.events).toEqual([
        { date: sharedDate, type: 'period' }
      ]);
    });
  });
});
