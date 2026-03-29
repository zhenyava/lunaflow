import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarEvents } from './useCalendarEvents';
import type { DailyRecord } from '../storage/DailyRecord';
import { makePeriodRecord } from '../storage/DailyRecord';

const listeners = new Set<() => void>();
const recordsStore = {
  data: null as DailyRecord[] | null,
  get events() {
    return (this.data ?? []).filter((r: DailyRecord) => !r.isDeleted);
  },
  cloudState: 'unsynced' as const,
  cloudPath: null as string | null,
  getRecord: vi.fn((dateStr: string) => {
    return (recordsStore.data ?? []).find((r: DailyRecord) => r.date === dateStr && !r.isDeleted);
  }),
  upsertRecord: vi.fn((dateStr: string, updates: Partial<DailyRecord>) => {
    const prev = recordsStore.data ?? [];
    const now = Date.now();
    const idx = prev.findIndex(r => r.date === dateStr);
    let newRecords: DailyRecord[];
    if (idx >= 0) {
      const newRecord = { ...prev[idx], ...updates, updatedAt: now };
      const hasPeriod = !!newRecord.period;
      const hasOvulation = !!newRecord.ovulation;
      const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;
      newRecord.isDeleted = !hasPeriod && !hasOvulation && !hasSymptoms;
      newRecords = [...prev];
      newRecords[idx] = newRecord;
    } else {
      const newRecord: DailyRecord = { date: dateStr, updatedAt: now, ...updates };
      const hasPeriod = !!newRecord.period;
      const hasOvulation = !!newRecord.ovulation;
      const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;
      newRecord.isDeleted = !hasPeriod && !hasOvulation && !hasSymptoms;
      newRecords = [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
    }
    recordsStore.data = newRecords;
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
    (recordsStore as { data: DailyRecord[] | null }).data = null;
    vi.mocked(recordsStore.upsertRecord).mockClear();
    vi.mocked(recordsStore.getRecord).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reflects recordsStore.events', () => {
    const mockEvents = [makePeriodRecord('2024-03-01')];
    (recordsStore as { data: DailyRecord[] | null }).data = mockEvents;

    const { result } = renderHook(() => useCalendarEvents(recordsStore));
    expect(result.current.events).toEqual(mockEvents);
  });

  describe('handleDayClick', () => {
    it('upserts a new period record when date is empty', () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.handleDayClick(new Date('2024-03-01T12:00:00Z'));
      });

      expect(recordsStore.upsertRecord).toHaveBeenCalledWith('2024-03-01', { period: {} });
    });

    it('upserts an ovulation record when activeType is ovulation', () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => result.current.setActiveType('ovulation'));
      act(() => result.current.handleDayClick(new Date('2024-03-05T12:00:00Z')));

      expect(recordsStore.upsertRecord).toHaveBeenCalledWith('2024-03-05', { ovulation: {} });
    });

    it('toggles off period when clicking existing period record', () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [makePeriodRecord('2024-03-01')];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => result.current.setActiveType('period'));
      act(() => result.current.handleDayClick(new Date('2024-03-01T12:00:00Z')));

      expect(recordsStore.upsertRecord).toHaveBeenCalledWith('2024-03-01', { period: undefined });
    });

    it('marks record as deleted when toggling off the only event', () => {
      (recordsStore as { data: DailyRecord[] | null }).data = [makePeriodRecord('2024-03-01')];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => result.current.setActiveType('period'));
      act(() => result.current.handleDayClick(new Date('2024-03-01T12:00:00Z')));

      expect(recordsStore.data![0].isDeleted).toBe(true);
    });
  });

  describe('updateRecord', () => {
    it('delegates to store.upsertRecord', () => {
      const existing = makePeriodRecord('2024-03-01');
      (recordsStore as { data: DailyRecord[] | null }).data = [existing];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.updateRecord('2024-03-01', { ovulation: {} });
      });

      expect(recordsStore.upsertRecord).toHaveBeenCalledWith('2024-03-01', { ovulation: {} });
    });

    it('marks record as deleted when all data is removed', () => {
      const existing = makePeriodRecord('2024-03-01');
      (recordsStore as { data: DailyRecord[] | null }).data = [existing];
      const { result } = renderHook(() => useCalendarEvents(recordsStore));

      act(() => {
        result.current.updateRecord('2024-03-01', { period: undefined });
      });

      expect(recordsStore.data![0].isDeleted).toBe(true);
    });
  });
});
