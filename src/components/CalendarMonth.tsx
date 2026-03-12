import React from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { DailyRecord } from '../types';

interface CalendarMonthProps {
  month: Date;
  events?: DailyRecord[];
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
    return {
      periodDates: events
        .filter(e => !!e.period)
        .map(e => parseISO(e.date)),
      ovulationDates: events
        .filter(e => !!e.ovulation)
        .map(e => parseISO(e.date)),
      predicted: Array.from(predictedDates || []).map(d => parseISO(d)),
      predictedOvulation: Array.from(predictedOvulationDates || []).map(d => parseISO(d))
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
