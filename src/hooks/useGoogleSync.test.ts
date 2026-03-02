import { describe, it, expect } from 'vitest';
import { eventsEqual } from './useGoogleSync';
import type { CalendarEvent } from '../types';

describe('useGoogleSync - eventsEqual', () => {
  it('returns true for identical arrays', () => {
    const arr1: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
      { date: '2024-01-14', type: 'ovulation' },
    ];
    const arr2: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
      { date: '2024-01-14', type: 'ovulation' },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(true);
  });

  it('returns false when arrays have different lengths', () => {
    const arr1: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
    ];
    const arr2: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
      { date: '2024-01-14', type: 'ovulation' },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when a date is different', () => {
    const arr1: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
    ];
    const arr2: CalendarEvent[] = [
      { date: '2024-01-02', type: 'period' },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns false when a type is different', () => {
    const arr1: CalendarEvent[] = [
      { date: '2024-01-01', type: 'period' },
    ];
    const arr2: CalendarEvent[] = [
      { date: '2024-01-01', type: 'ovulation' },
    ];
    expect(eventsEqual(arr1, arr2)).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(eventsEqual([], [])).toBe(true);
  });
});
