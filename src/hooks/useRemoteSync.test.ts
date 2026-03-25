import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventsEqual } from './useRemoteSync';
import type { DailyRecord } from '../types';
import { makePeriodRecord, makeOvulationRecord } from '../types';

describe('useRemoteSync - eventsEqual', () => {

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('returns true for identical arrays', () => {
    const arr1: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
      makeOvulationRecord('2024-01-14'),
    ];
    const arr2: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
      makeOvulationRecord('2024-01-14'),
    ];
    expect(eventsEqual(arr1, arr2)).toBe(true);
  });

  it('returns false when arrays have different lengths', () => {
    const arr1: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
    ];
    const arr2: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
      makeOvulationRecord('2024-01-14'),
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when a date is different', () => {
    const arr1: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
    ];
    const arr2: DailyRecord[] = [
      makePeriodRecord('2024-01-02'),
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when updatedAt is different', () => {
    const arr1: DailyRecord[] = [
      makePeriodRecord('2024-01-01'),
    ];
    const arr2: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now() + 100, period: {} },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(eventsEqual([], [])).toBe(true);
  });
});
