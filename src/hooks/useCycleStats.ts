import { useMemo } from 'react';
import { addMonths, endOfYear, max, startOfMonth } from 'date-fns';
import type { DailyRecord } from '../storage/DailyRecord';
import { 
    calculateAverageCycleLength, 
    calculateAverageDuration, 
    predictFuturePeriods,
    predictFutureOvulations
} from '../services/statsService';

export function useCycleStats(events: readonly DailyRecord[], currentYear: number) {
  // 1. Calculate Averages
  const avgCycleLength = useMemo(() => calculateAverageCycleLength(events), [events]);
  const avgPeriodDuration = useMemo(() => calculateAverageDuration(events), [events]);

  // 2. Calculate Predictions
  const { predictedDates, predictedOvulationDates } = useMemo(() => {
    // Determine the range limit for predictions
    // We want to cover at least 12 months ahead (for mobile infinite scroll)
    // AND the entire selected desktop year.
    const mobileLimit = addMonths(startOfMonth(new Date()), 12);
    const desktopLimit = endOfYear(new Date(currentYear, 0, 1));
    
    // Take the furthest date
    const limit = max([mobileLimit, desktopLimit]);
    
    return {
      predictedDates: predictFuturePeriods(events, avgCycleLength, limit),
      predictedOvulationDates: predictFutureOvulations(events, avgCycleLength, limit)
    };
  }, [events, avgCycleLength, currentYear]);

  return {
    avgCycleLength,
    avgPeriodDuration,
    predictedDates,
    predictedOvulationDates
  };
}
