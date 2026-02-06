import React from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

interface CalendarMonthProps {
  month: Date;
  onDayClick?: (date: Date) => void;
  className?: string;
}

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  month, 
  onDayClick,
  className = '' 
}) => {
  return (
    <div className={`w-full ${className}`}>
      <DayPicker
        month={month}
        onMonthChange={() => {}} 
        disableNavigation
        hideNavigation
        onDayClick={onDayClick}
        modifiersClassNames={{
          today: "rounded-full border-2 border-slate-900 font-bold aspect-square flex items-center justify-center",
        }}
        classNames={{
          month_grid: "w-full table-fixed",
          day: "w-full h-full",
        }}
      />
    </div>
  );
};

export default React.memo(CalendarMonth);
