import React from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { CalendarEvent } from '../types';

interface CalendarMonthProps {
  month: Date;
  events?: CalendarEvent[];
  predictedDates?: Set<string>;
  predictedOvulationDates?: Set<string>;
  onDayClick?: (date: Date) => void;
  className?: string;
}

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  month, 
  events = [],
  predictedDates,
  predictedOvulationDates,
  onDayClick,
  className = '' 
}) => {
  // Memoize dates calculation to prevent unnecessary work on every render
  const { periodDates, ovulationDates, predicted, predictedOvulation } = React.useMemo(() => {
    const pDates: Date[] = [];
    const oDates: Date[] = [];

    // Cache for parsed dates within this render cycle
    const parsedCache: Record<string, Date> = {};
    const getParsedDate = (d: string) => {
      let parsed = parsedCache[d];
      if (!parsed) {
        // Fast path for strict YYYY-MM-DD format commonly used in the app
        if (d.length === 10 && d[4] === '-' && d[7] === '-') {
          const y = parseInt(d.slice(0, 4), 10);
          const m = parseInt(d.slice(5, 7), 10) - 1;
          const day = parseInt(d.slice(8, 10), 10);
          parsed = new Date(y, m, day);
        } else {
          // Fallback to date-fns for other ISO formats
          parsed = parseISO(d);
        }
        parsedCache[d] = parsed;
      }
      return parsed;
    };

    // Process events in a single loop instead of multiple filter/map passes
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'period') {
        pDates.push(getParsedDate(e.date));
      } else if (e.type === 'ovulation') {
        oDates.push(getParsedDate(e.date));
      }
    }

    return {
      periodDates: pDates,
      ovulationDates: oDates,
      predicted: Array.from(predictedDates || []).map(getParsedDate),
      predictedOvulation: Array.from(predictedOvulationDates || []).map(getParsedDate)
    };
  }, [events, predictedDates, predictedOvulationDates]);

  return (
    <div className={`w-full ${className}`}>
      <DayPicker
        month={month}
        onMonthChange={() => {}} 
        disableNavigation
        hideNavigation
        onDayClick={onDayClick}
        modifiers={{
          period: periodDates,
          ovulation: ovulationDates,
          predicted: predicted,
          predictedOvulation: predictedOvulation
        }}
        modifiersClassNames={{
          today: "[&_button]:border-2 [&_button]:border-slate-300 [&_button]:font-bold",
          period: "[&_button]:bg-rose-500 [&_button]:text-white",
          ovulation: "[&_button]:bg-violet-500 [&_button]:text-white",
          predicted: "[&_button]:border-2 [&_button]:border-dashed [&_button]:border-rose-300 [&_button]:text-rose-500 [&_button]:bg-rose-50",
          predictedOvulation: "[&_button]:border-2 [&_button]:border-dashed [&_button]:border-violet-300 [&_button]:text-violet-500 [&_button]:bg-violet-50"
        }}
        classNames={{
          month_grid: "w-full table-fixed",
          day: "p-0.5",
          // Removed transition-colors to eliminate perceived lag on click
          day_button: "w-full aspect-square flex items-center justify-center rounded-full",
        }}
      />
    </div>
  );
};

export default React.memo(CalendarMonth);
