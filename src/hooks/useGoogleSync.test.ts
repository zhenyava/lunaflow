import { describe, it, expect } from 'vitest';
import { eventsEqual } from './useGoogleSync';
import type { DailyRecord } from '../types';

describe('useGoogleSync - eventsEqual', () => {
  it('returns true for identical arrays', () => {
    const arr1: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
      { date: '2024-01-14', updatedAt: Date.now(), ovulation: { isConfirmed: true } },
    ];
    const arr2: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
      { date: '2024-01-14', updatedAt: Date.now(), ovulation: { isConfirmed: true } },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(true);
  });

  it('returns false when arrays have different lengths', () => {
    const arr1: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
    ];
    const arr2: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
      { date: '2024-01-14', updatedAt: Date.now(), ovulation: { isConfirmed: true } },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when a date is different', () => {
    const arr1: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
    ];
    const arr2: DailyRecord[] = [
      { date: '2024-01-02', updatedAt: Date.now(), period: { isFlowing: true } },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when updatedAt is different', () => {
    const arr1: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now(), period: { isFlowing: true } },
    ];
    const arr2: DailyRecord[] = [
      { date: '2024-01-01', updatedAt: Date.now() + 100, period: { isFlowing: true } },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(eventsEqual([], [])).toBe(true);
  });
});
