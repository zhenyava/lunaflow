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
  const limit = useMemo(() => {
    const mobileLimit = addMonths(startOfMonth(new Date()), 12);
    const desktopLimit = endOfYear(new Date(currentYear, 0, 1));
    return max([mobileLimit, desktopLimit]);
  }, [currentYear]);

  const predictedDates = useMemo(() => {
    return predictFuturePeriods(events, avgCycleLength, limit);
  }, [events, avgCycleLength, limit]);

  const predictedOvulationDates = useMemo(() => {
    return predictFutureOvulations(events, avgOvulationCycleLength || avgCycleLength, limit);
  }, [events, avgOvulationCycleLength, avgCycleLength, limit]);

  return {
    avgCycleLength,
    avgPeriodDuration,
    predictedDates,
    predictedOvulationDates
  };
}
