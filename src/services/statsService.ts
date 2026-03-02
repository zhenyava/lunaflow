import { differenceInDays, parseISO, addDays, format, isAfter } from 'date-fns';
import type { CalendarEvent } from '../types';

/**
 * Helper to group continuous period days into clusters (cycles)
 */
const getPeriodClusters = (events: CalendarEvent[]) => {
  const periodEvents = events
    .filter(e => e.type === 'period')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (periodEvents.length === 0) return [];

  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let lastDate: Date | null = null;

  for (const event of periodEvents) {
    const currentDate = parseISO(event.date);
    
    if (!lastDate) {
      currentCluster.push(event);
    } else {
      const diff = differenceInDays(currentDate, lastDate);
      // If gap > 7 days, consider it a new cycle start
      if (diff > 7) {
        clusters.push(currentCluster);
        currentCluster = [event];
      } else {
        currentCluster.push(event);
      }
    }
    lastDate = currentDate;
  }
  
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters;
};

export const calculateAverageCycleLength = (events: CalendarEvent[]): number | null => {
  const clusters = getPeriodClusters(events);

  // Need at least 2 cycles to calculate a gap
  if (clusters.length < 2) return null;

  const cycleStartDates = clusters.map(c => c[0].date);
  
  let totalDays = 0;
  let cycleCount = 0;

  for (let i = 0; i < cycleStartDates.length - 1; i++) {
    const start1 = parseISO(cycleStartDates[i]);
    const start2 = parseISO(cycleStartDates[i+1]);
    const diff = differenceInDays(start2, start1);
    
    // Sanity check: 10 to 100 days
    if (diff >= 10 && diff <= 100) {
        totalDays += diff;
        cycleCount++;
    }
  }

  return cycleCount > 0 ? Math.round(totalDays / cycleCount) : null;
};

export const calculateAverageDuration = (events: CalendarEvent[]): number | null => {
    const clusters = getPeriodClusters(events);
    if (clusters.length === 0) return null;

    const totalDuration = clusters.reduce((acc, cluster) => acc + cluster.length, 0);
    return Math.round(totalDuration / clusters.length) || null;
};

/**
 * Generates a Set of date strings (YYYY-MM-DD) representing potential future period days.
 */
export const predictFuturePeriods = (
    events: CalendarEvent[], 
    avgCycleLength: number | null,
    endDateLimit: Date
): Set<string> => {
    const predicted = new Set<string>();
    
    if (!avgCycleLength || avgCycleLength < 10) return predicted;

    const clusters = getPeriodClusters(events);
    if (clusters.length === 0) return predicted;

    // Get stats
    const avgDuration = calculateAverageDuration(events) ?? 5;
    
    // Start from the last known period start date
    const lastCluster = clusters[clusters.length - 1];
    const lastStartDate = parseISO(lastCluster[0].date);

    // Project forward
    let nextStartDate = addDays(lastStartDate, avgCycleLength);

    // Generate until we hit the visual limit of the calendar
    while (!isAfter(nextStartDate, endDateLimit)) {
        // Add all days for this predicted cycle (based on avg duration)
        for (let i = 0; i < avgDuration; i++) {
            const date = addDays(nextStartDate, i);
            if (!isAfter(date, endDateLimit)) {
                predicted.add(format(date, 'yyyy-MM-dd'));
            }
        }
        
        // Move to next cycle
        nextStartDate = addDays(nextStartDate, avgCycleLength);
    }

    return predicted;
};
/**
 * Generates a Set of date strings (YYYY-MM-DD) representing potential future ovulation days.
 */
export const predictFutureOvulations = (
    events: CalendarEvent[],
    avgCycleLength: number | null,
    endDateLimit: Date
): Set<string> => {
    const predicted = new Set<string>();

    if (!avgCycleLength || avgCycleLength < 10) return predicted;

    const ovulationEvents = events
        .filter(e => e.type === 'ovulation')
        .sort((a, b) => a.date.localeCompare(b.date));

    if (ovulationEvents.length === 0) return predicted;

    // Start from the last known ovulation date
    const lastOvulationDate = parseISO(ovulationEvents[ovulationEvents.length - 1].date);

    // Project forward
    let nextOvulationDate = addDays(lastOvulationDate, avgCycleLength);

    // Generate until we hit the visual limit of the calendar
    while (!isAfter(nextOvulationDate, endDateLimit)) {
        predicted.add(format(nextOvulationDate, 'yyyy-MM-dd'));

        // Move to next cycle
        nextOvulationDate = addDays(nextOvulationDate, avgCycleLength);
    }

    return predicted;
};
