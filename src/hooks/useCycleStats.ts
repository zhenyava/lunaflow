import { useMemo } from 'react';
import { addMonths, endOfYear, max, startOfMonth } from 'date-fns';
import type { CalendarEvent } from '../types';
import { 
    calculateAverageCycleLength, 
    calculateAverageDuration, 
    predictFuturePeriods,
    predictFutureOvulations
} from '../services/statsService';

export function useCycleStats(events: CalendarEvent[], currentYear: number) {
  // 1. Calculate Averages
  const avgCycleLength = useMemo(() => calculateAverageCycleLength(events, 'period'), [events]);
  const avgOvulationCycleLength = useMemo(() => calculateAverageCycleLength(events, 'ovulation'), [events]);
  const avgPeriodDuration = useMemo(() => calculateAverageDuration(events, 'period'), [events]);

  // 2. Calculate Predictions
  const predictedDates = useMemo(() => {
    // Determine the range limit for predictions
    // We want to cover at least 12 months ahead (for mobile infinite scroll)
    // AND the entire selected desktop year.
    const mobileLimit = addMonths(startOfMonth(new Date()), 12);
    const desktopLimit = endOfYear(new Date(currentYear, 0, 1));
    
    // Take the furthest date
    const limit = max([mobileLimit, desktopLimit]);
    
    return predictFuturePeriods(events, avgCycleLength, limit);
  }, [events, avgCycleLength, currentYear]);

  const predictedOvulationDates = useMemo(() => {
    const mobileLimit = addMonths(startOfMonth(new Date()), 12);
    const desktopLimit = endOfYear(new Date(currentYear, 0, 1));
    const limit = max([mobileLimit, desktopLimit]);

    return predictFutureOvulations(events, avgOvulationCycleLength || avgCycleLength, limit);
  }, [events, avgOvulationCycleLength, avgCycleLength, currentYear]);

  return {
    avgCycleLength,
    avgPeriodDuration,
    predictedDates,
    predictedOvulationDates
  };
}
