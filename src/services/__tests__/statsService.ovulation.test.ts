import { describe, it, expect } from 'vitest';
import {
  calculateAverageCycleLength,
  predictFutureOvulations
} from '../statsService';
import type { CalendarEvent } from '../../types';

describe('statsService - ovulation', () => {
  const createEvent = (date: string, type: CalendarEvent['type'] = 'ovulation'): CalendarEvent => ({
    date,
    type
  });

  describe('calculateAverageCycleLength with ovulation', () => {
    it('should correctly calculate cycle length for ovulation events', () => {
      const events: CalendarEvent[] = [
        createEvent('2024-01-14'),
        createEvent('2024-02-11'),
      ];
      // Diff between Feb 11 and Jan 14 is 28 days
      expect(calculateAverageCycleLength(events, 'ovulation')).toBe(28);
    });
  });

  describe('predictFutureOvulations', () => {
    it('should return empty set if cycle length invalid', () => {
        const events = [createEvent('2024-01-14')];
        const result = predictFutureOvulations(events, null, new Date('2024-12-31'));
        expect(result.size).toBe(0);
    });

    it('should predict future dates based on avg cycle and duration for ovulations', () => {
        const events = [
            createEvent('2024-01-14')
        ];
        const avgCycle = 28;
        const limit = new Date('2024-03-15');

        // Next start: Jan 14 + 28 = Feb 11
        // Duration 1: Feb 11
        // Next start: Feb 11 + 28 = Mar 10
        // Duration 1: Mar 10

        const prediction = predictFutureOvulations(events, avgCycle, limit);

        expect(prediction.has('2024-02-11')).toBe(true);
        expect(prediction.has('2024-03-10')).toBe(true);
        expect(prediction.has('2024-03-11')).toBe(false);
    });
  });
});
