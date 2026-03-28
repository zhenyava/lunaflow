import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import type { DailyRecord } from '../storage/DailyRecord';
import { makePeriodRecord } from '../storage/DailyRecord';

const listeners = new Set<() => void>();
const recordsStore = {
  data: null as DailyRecord[] | null,
  get events() {
    return (this.data ?? []).filter((r: DailyRecord) => !r.isDeleted);
  },
  get allRecords() {
    return this.data;
  },
  cloudState: 'unsynced' as const,
  cloudPath: null as string | null,
  save: vi.fn(async function(records: DailyRecord[]) {
    recordsStore.data = records;
    listeners.forEach(fn => fn());
  }),
  subscribe: vi.fn((fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }),
  init: vi.fn(),
  destroy: vi.fn(),
  forceSync: vi.fn(async () => {}),
};

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
    // Reset store state
    (recordsStore as { data: DailyRecord[] | null }).data = null;
    vi.mocked(recordsStore.save).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reflects recordsStore.events', async () => {
    const mockEvents = [makePeriodRecord('2024-03-01')];
    (recordsStore as { data: DailyRecord[] | null }).data = mockEvents;

    const { result } = renderHook(() => useCalendarEvents(recordsStore));
    expect(result.current.events).toEqual(mockEvents);
  });

  describe('handleDayClick', () => {
    it('adds a new period record when date is empty', async () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      expect(recordsStore.save).toHaveBeenCalledWith([
        { date: '2024-03-01', updatedAt: Date.now(), isDeleted: false, period: {} },
      ]);
    });

    it('adds ovulation record when activeType is ovulation', async () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => result.current.setActiveType('ovulation'));
      act(() => result.current.handleDayClick(new Date('2024-03-05T12:00:00Z')));

      expect(recordsStore.save).toHaveBeenCalledWith([
        { date: '2024-03-05', updatedAt: Date.now(), isDeleted: false, ovulation: {} },
      ]);
    });

    it('marks record as deleted when toggling off the only event', async () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [makePeriodRecord('2024-03-01')];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => result.current.setActiveType('period'));
      act(() => result.current.handleDayClick(new Date('2024-03-01T12:00:00Z')));

      const saved = vi.mocked(recordsStore.save).mock.calls[0][0];
      expect(saved[0].isDeleted).toBe(true);
    });
  });

  describe('updateRecord', () => {
    it('updates existing record and calls recordsStore.save', async () => {
      const existing = makePeriodRecord('2024-03-01');
      (recordsStore as { data: DailyRecord[] | null }).data = [existing];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.updateRecord('2024-03-01', { ovulation: {} });
      });

      await waitFor(() => {
        expect(recordsStore.save).toHaveBeenCalled();
      });

      const saved = vi.mocked(recordsStore.save).mock.calls[0][0];
      expect(saved[0].ovulation).toEqual({});
      expect(saved[0].period).toEqual({});
    });

    it('marks record as deleted when all data is removed', async () => {
      const existing = makePeriodRecord('2024-03-01');
      (recordsStore as { data: DailyRecord[] | null }).data = [existing];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.updateRecord('2024-03-01', { period: undefined });
      });

      const saved = vi.mocked(recordsStore.save).mock.calls[0][0];
      expect(saved[0].isDeleted).toBe(true);
    });
  });
});
