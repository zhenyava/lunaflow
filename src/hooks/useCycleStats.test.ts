import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCycleStats } from './useCycleStats';
import * as statsService from '../services/statsService';
import type { CalendarEvent } from '../types';

vi.mock('../services/statsService', () => ({
  calculateAverageCycleLength: vi.fn(),
  calculateAverageDuration: vi.fn(),
  predictFuturePeriods: vi.fn(),
  predictFutureOvulations: vi.fn(),
}));

describe('useCycleStats', () => {
  const mockEvents: CalendarEvent[] = [
    { date: '2024-01-01', type: 'period' },
    { date: '2024-01-29', type: 'period' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate averages and predictions based on events', () => {
    vi.mocked(statsService.calculateAverageCycleLength).mockReturnValue(28);
    vi.mocked(statsService.calculateAverageDuration).mockReturnValue(5);
    vi.mocked(statsService.predictFuturePeriods).mockReturnValue(new Set(['2024-04-10', '2024-04-11']));
    vi.mocked(statsService.predictFutureOvulations).mockReturnValue(new Set(['2024-04-24']));

    const currentYear = 2024;
    const { result } = renderHook(() => useCycleStats(mockEvents, currentYear));

    expect(statsService.calculateAverageCycleLength).toHaveBeenCalledWith(mockEvents);
    expect(statsService.calculateAverageDuration).toHaveBeenCalledWith(mockEvents);

    expect(result.current.avgCycleLength).toBe(28);
    expect(result.current.avgPeriodDuration).toBe(5);
    expect(result.current.predictedDates).toEqual(new Set(['2024-04-10', '2024-04-11']));
    expect(result.current.predictedOvulationDates).toEqual(new Set(['2024-04-24']));
  });

  it('should use mobileLimit when it is further than desktopLimit (e.g. current year)', () => {
    // Current date: 2024-03-15
    // mobileLimit = 2025-03-01T00:00:00.000Z (addMonths(startOfMonth(new Date()), 12))
    // desktopLimit = 2024-12-31T23:59:59.999Z (endOfYear(new Date(2024, 0, 1)))
    // Therefore mobileLimit > desktopLimit

    vi.mocked(statsService.calculateAverageCycleLength).mockReturnValue(28);
    vi.mocked(statsService.predictFuturePeriods).mockReturnValue(new Set([]));
    vi.mocked(statsService.predictFutureOvulations).mockReturnValue(new Set([]));

    const currentYear = 2024;
    renderHook(() => useCycleStats(mockEvents, currentYear));

    const expectedMobileLimit = new Date('2025-03-01T00:00:00.000Z');

    // Check if statsService received the correct limit
    const lastCallPeriods = vi.mocked(statsService.predictFuturePeriods).mock.calls[0];
    expect(lastCallPeriods[2]).toEqual(expectedMobileLimit);

    const lastCallOvulations = vi.mocked(statsService.predictFutureOvulations).mock.calls[0];
    expect(lastCallOvulations[2]).toEqual(expectedMobileLimit);
  });

  it('should use desktopLimit when it is further than mobileLimit (e.g. future year selected)', () => {
    // Current date: 2024-03-15
    // mobileLimit = 2025-03-01T00:00:00.000Z
    // desktopLimit = 2025-12-31T23:59:59.999Z (endOfYear(new Date(2025, 0, 1)))
    // Therefore desktopLimit > mobileLimit

    vi.mocked(statsService.calculateAverageCycleLength).mockReturnValue(28);
    vi.mocked(statsService.predictFuturePeriods).mockReturnValue(new Set([]));
    vi.mocked(statsService.predictFutureOvulations).mockReturnValue(new Set([]));

    const futureYear = 2025;
    renderHook(() => useCycleStats(mockEvents, futureYear));

    // endOfYear(new Date(2025, 0, 1)) in local time - using exact calculation matching useCycleStats
    // we just check that the timestamp is the end of the year 2025

    // Get the limit passed to predictFuturePeriods
    const lastCallPeriods = vi.mocked(statsService.predictFuturePeriods).mock.calls[0];
    const actualLimit = lastCallPeriods[2] as Date;

    expect(actualLimit.getFullYear()).toBe(2025);
    expect(actualLimit.getMonth()).toBe(11); // December
    expect(actualLimit.getDate()).toBe(31);
    expect(actualLimit.getHours()).toBe(23);
    expect(actualLimit.getMinutes()).toBe(59);
    expect(actualLimit.getSeconds()).toBe(59);
    expect(actualLimit.getMilliseconds()).toBe(999);
  });
});
