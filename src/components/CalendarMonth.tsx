import React from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { CalendarEvent } from '../types';

interface CalendarMonthProps {
  month: Date;
  events?: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  className?: string;
}

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  month, 
  events = [],
  onDayClick,
  className = '' 
}) => {
  // Memoize dates calculation to prevent unnecessary work on every render
  const periodDates = React.useMemo(() => 
    events
      .filter(e => e.type === 'period')
      .map(e => parseISO(e.date)),
    [events]
  );

  return (
    <div className={`w-full ${className}`}>
      <DayPicker
        month={month}
        onMonthChange={() => {}} 
        disableNavigation
        hideNavigation
        onDayClick={onDayClick}
        modifiers={{
          period: periodDates
        }}
        modifiersClassNames={{
          today: "[&_button]:border-2 [&_button]:border-slate-900 [&_button]:font-bold",
          period: "[&_button]:bg-rose-500 [&_button]:text-white"
        }}
        classNames={{
          month_grid: "w-full table-fixed",
          day: "p-0",
          // Removed transition-colors to eliminate perceived lag on click
          day_button: "w-full aspect-square flex items-center justify-center rounded-full",
        }}
      />
    </div>
  );
};

export default React.memo(CalendarMonth);
