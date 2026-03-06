import { describe, it, expect } from 'vitest';
import { 
  calculateAverageCycleLength, 
  calculateAverageDuration, 
  predictFuturePeriods,
  predictFutureOvulations,
  calculateAverageOvulationCycleLength,
  calculateAverageOvulationDuration
} from './statsService';
import type { DailyRecord } from '../types';

describe('statsService', () => {
  const createEvent = (date: string): DailyRecord => ({
    date,
    updatedAt: 123, period: { isFlowing: true }
  });

  describe('calculateAverageCycleLength', () => {
    it('should return null if there are fewer than 2 cycles', () => {
      // 3 days of a single cycle
      const events: DailyRecord[] = [
        createEvent('2024-01-01'),
        createEvent('2024-01-02'),
        createEvent('2024-01-03'),
      ];
      expect(calculateAverageCycleLength(events)).toBeNull();
    });

    it('should calculate correct cycle length for 2 regular cycles', () => {
      const events: DailyRecord[] = [
        // Cycle 1 starts Jan 1
        createEvent('2024-01-01'),
        createEvent('2024-01-02'),
        createEvent('2024-01-03'),
        // Cycle 2 starts Jan 29 (28 days later)
        createEvent('2024-01-29'),
        createEvent('2024-01-30'),
        createEvent('2024-01-31'),
      ];
      // Diff between Jan 29 and Jan 1 is 28 days
      expect(calculateAverageCycleLength(events)).toBe(28);
    });

    it('should average multiple cycle lengths', () => {
      const events: DailyRecord[] = [
        // Cycle 1: Jan 1
        createEvent('2024-01-01'), 
        // Cycle 2: Jan 29 (28 days later)
        createEvent('2024-01-29'),
        // Cycle 3: Feb 28 (30 days after Jan 29)
        createEvent('2024-02-28'), 
      ];
      // (28 + 30) / 2 = 29
      expect(calculateAverageCycleLength(events)).toBe(29);
    });

    it('should ignore short cycles (< 10 days)', () => {
      const events: DailyRecord[] = [
        // Cycle 1: Jan 1
        createEvent('2024-01-01'),
        // Cycle 2: Jan 10 (9 days later - >7 gap so new cluster, but 9 < 10 so ignored cycle)
        createEvent('2024-01-10'),
        // Cycle 3: Feb 7 (28 days after Jan 10 - this one is valid)
        createEvent('2024-02-07'),
      ];
      // Cycle 1->2 (9 days): Ignored
      // Cycle 2->3 (28 days): Included
      // Avg = 28
      expect(calculateAverageCycleLength(events)).toBe(28);
    });

    it('should ignore long cycles (> 100 days)', () => {
      const events: DailyRecord[] = [
        // Cycle 1: Jan 1
        createEvent('2024-01-01'),
        // Cycle 2: June 1 (152 days later - ignored)
        createEvent('2024-06-01'),
        // Cycle 3: June 29 (28 days later - valid)
        createEvent('2024-06-29'),
      ];
      expect(calculateAverageCycleLength(events)).toBe(28);
    });

    it('should handle unsorted events correctly', () => {
      const events: DailyRecord[] = [
        createEvent('2024-01-29'),
        createEvent('2024-01-01'),
      ];
      expect(calculateAverageCycleLength(events)).toBe(28);
    });

    it('should handle gaps <= 7 days as same cluster (not a new cycle)', () => {
      const events: DailyRecord[] = [
        createEvent('2024-01-01'),
        createEvent('2024-01-02'),
        // Gap of 6 days (Jan 8 - Jan 2 = 6). Should remain in same cluster.
        createEvent('2024-01-08'), 
        // Next real cycle
        createEvent('2024-02-01'), // 31 days after Jan 1
      ];
      
      // Cluster 1: Jan 1, Jan 2, Jan 8. Start: Jan 1.
      // Cluster 2: Feb 1. Start: Feb 1.
      // Diff: 31 days.
      expect(calculateAverageCycleLength(events)).toBe(31);
    });

    it('should handle gaps > 7 days as new cluster', () => {
      const events: DailyRecord[] = [
        createEvent('2024-01-01'),
        // Gap of 8 days (Jan 9 - Jan 1 = 8). New cluster.
        createEvent('2024-01-09'), 
      ];
      // Cluster 1: Jan 1
      // Cluster 2: Jan 9
      // Diff: 8 days.
      // 8 days is < 10 days min limit, so it should be ignored in avg calculation.
      // Result null because 0 valid cycles.
      expect(calculateAverageCycleLength(events)).toBeNull();
    });
  });

  describe('calculateAverageDuration', () => {
    it('should return null for no events', () => {
      expect(calculateAverageDuration([])).toBeNull();
    });

    it('should calculate average duration correctly', () => {
      const events: DailyRecord[] = [
        // Cluster 1: 3 days
        createEvent('2024-01-01'),
        createEvent('2024-01-02'),
        createEvent('2024-01-03'),
        // Cluster 2: 5 days
        createEvent('2024-02-01'),
        createEvent('2024-02-02'),
        createEvent('2024-02-03'),
        createEvent('2024-02-04'),
        createEvent('2024-02-05'),
      ];
      // (3 + 5) / 2 = 4
      expect(calculateAverageDuration(events)).toBe(4);
    });

    it('should round duration to nearest integer', () => {
      const events: DailyRecord[] = [
        // Cluster 1: 3 days
        createEvent('2024-01-01'),
        createEvent('2024-01-02'),
        createEvent('2024-01-03'),
        // Cluster 2: 4 days
        createEvent('2024-02-01'),
        createEvent('2024-02-02'),
        createEvent('2024-02-03'),
        createEvent('2024-02-04'),
      ];
      // (3 + 4) / 2 = 3.5 -> round to 4
      expect(calculateAverageDuration(events)).toBe(4);
    });
  });
  
  describe('predictFuturePeriods', () => {
      it('should return empty set if cycle length invalid', () => {
          const events = [createEvent('2024-01-01')];
          const result = predictFuturePeriods(events, null, new Date('2024-12-31'));
          expect(result.size).toBe(0);
      });

      it('should predict future dates based on avg cycle and duration', () => {
          // Last cycle started Jan 1. Avg cycle 28. Avg duration 4.
          const events = [
              createEvent('2024-01-01'),
              createEvent('2024-01-02'),
              createEvent('2024-01-03'),
              createEvent('2024-01-04'),
          ];
          const avgCycle = 28;
          // Limit: End of Feb
          const limit = new Date('2024-02-29');

          // Expected: 
          // Next start: Jan 1 + 28 = Jan 29.
          // Duration 4: Jan 29, 30, 31, Feb 1.
          // Next start: Jan 29 + 28 = Feb 26.
          // Duration 4: Feb 26, 27, 28, 29.
          
          const prediction = predictFuturePeriods(events, avgCycle, limit);
          
          expect(prediction.has('2024-01-29')).toBe(true);
          expect(prediction.has('2024-02-01')).toBe(true); // 4th day of 1st prediction
          expect(prediction.has('2024-02-26')).toBe(true); // Start of 2nd
          expect(prediction.has('2024-02-29')).toBe(true); // End of limit
          expect(prediction.has('2024-03-01')).toBe(false); // Out of bounds
      });
  });

  describe('predictFutureOvulations', () => {
    it('should handle multi-day ovulation events', () => {
      const events: DailyRecord[] = [
        { date: '2024-01-09', updatedAt: 123, ovulation: { isConfirmed: true } },
        { date: '2024-01-10', updatedAt: 123, ovulation: { isConfirmed: true } },
        { date: '2024-02-09', updatedAt: 123, ovulation: { isConfirmed: true } },
        { date: '2024-02-10', updatedAt: 123, ovulation: { isConfirmed: true } },
      ];
      const avgCycle = 28;
      const limit = new Date('2024-04-15');

      const prediction = predictFutureOvulations(events, avgCycle, limit);

      // Avg cycle: 31 days (Jan 9 to Feb 9). Duration: 2 days.
      // Next: Feb 9 + 31 = Mar 11
      expect(prediction.has('2024-03-11')).toBe(true);
      expect(prediction.has('2024-03-12')).toBe(true);
      expect(prediction.has('2024-04-11')).toBe(true);
      expect(prediction.has('2024-04-12')).toBe(true);
      expect(prediction.size).toBe(4);
    });

    it('should return empty set if cycle length is invalid', () => {
      const events: DailyRecord[] = [{ date: '2024-01-14', updatedAt: 123, ovulation: { isConfirmed: true } }];
      const result = predictFutureOvulations(events, null, new Date('2024-12-31'));
      expect(result.size).toBe(0);
    });

    it('should return empty set if no ovulation events exist', () => {
      const events: DailyRecord[] = [{ date: '2024-01-01', updatedAt: 123, period: { isFlowing: true } }];
      const result = predictFutureOvulations(events, 28, new Date('2024-12-31'));
      expect(result.size).toBe(0);
    });

    it('should predict future ovulation dates based on avg cycle length (fallback)', () => {
      const events: DailyRecord[] = [
        { date: '2024-01-14', updatedAt: 123, ovulation: { isConfirmed: true } }
      ];
      const avgCycle = 28;
      const limit = new Date('2024-03-15');

      const prediction = predictFutureOvulations(events, avgCycle, limit);

      // Expected ovulations:
      // Jan 14 + 28 = Feb 11
      // Feb 11 + 28 = Mar 10
      expect(prediction.has('2024-02-11')).toBe(true);
      expect(prediction.has('2024-03-10')).toBe(true);
      expect(prediction.has('2024-04-07')).toBe(false); // Out of bounds
      expect(prediction.size).toBe(2);
    });

    it('should prioritize ovulation cycle average over period cycle average', () => {
      const events: DailyRecord[] = [
        { date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } },
        { date: '2024-01-31', updatedAt: 123, ovulation: { isConfirmed: true } } // 30 day ovulation cycle
      ];
      // Suppose we pass 28 from the period calculation, but ovulation has a 30-day average
      const periodAvgCycle = 28;
      const limit = new Date('2024-04-05');

      const prediction = predictFutureOvulations(events, periodAvgCycle, limit);

      // Expected ovulations:
      // Jan 31 + 30 = Mar 1 (Leap year 2024)
      // Mar 1 + 30 = Mar 31
      expect(prediction.has('2024-03-01')).toBe(true);
      expect(prediction.has('2024-03-31')).toBe(true);
      expect(prediction.size).toBe(2);
    });
  });

  describe('calculateAverageOvulationCycleLength', () => {
    it('should return null if fewer than 2 ovulation events', () => {
        const events: DailyRecord[] = [{ date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } }];
        expect(calculateAverageOvulationCycleLength(events)).toBeNull();
    });

    it('should calculate correct ovulation cycle length for 2 events', () => {
        const events: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } },
            { date: '2024-01-29', updatedAt: 123, ovulation: { isConfirmed: true } }
        ];
        expect(calculateAverageOvulationCycleLength(events)).toBe(28);
    });

    it('should average multiple ovulation cycle lengths', () => {
        const events: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } },
            { date: '2024-01-29', updatedAt: 123, ovulation: { isConfirmed: true } },
            { date: '2024-02-28', updatedAt: 123, ovulation: { isConfirmed: true } } // 30 days diff
        ];
        // (28 + 30) / 2 = 29
        expect(calculateAverageOvulationCycleLength(events)).toBe(29);
    });

    it('should filter out invalid ovulation cycle lengths (< 10 or > 100 days)', () => {
        const events: DailyRecord[] = [
            { date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } },
            { date: '2024-01-05', updatedAt: 123, ovulation: { isConfirmed: true } }, // diff 4 days, ignore
            { date: '2024-02-02', updatedAt: 123, ovulation: { isConfirmed: true } }, // diff 32 days from Jan 1
            { date: '2024-06-02', updatedAt: 123, ovulation: { isConfirmed: true } }  // diff 121 days, ignore
        ];
        // Only 32 is valid
        expect(calculateAverageOvulationCycleLength(events)).toBe(32);
    });
  });

  describe('calculateAverageOvulationDuration', () => {
    it('should return null for no events', () => {
      expect(calculateAverageOvulationDuration([])).toBeNull();
    });

    it('should calculate average ovulation duration correctly', () => {
      const events: DailyRecord[] = [
        // Cluster 1: 2 days
        { date: '2024-01-01', updatedAt: 123, ovulation: { isConfirmed: true } },
        { date: '2024-01-02', updatedAt: 123, ovulation: { isConfirmed: true } },
        // Cluster 2: 1 day
        { date: '2024-02-01', updatedAt: 123, ovulation: { isConfirmed: true } }
      ];
      // (2 + 1) / 2 = 1.5 -> round to 2
      expect(calculateAverageOvulationDuration(events)).toBe(2);
    });
  });
});
