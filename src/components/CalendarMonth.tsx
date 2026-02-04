import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday
} from 'date-fns';
import type { CalendarEvent } from '../types';
import { PERIOD_COLOR, OVULATION_COLOR } from '../constants';

interface CalendarMonthProps {
  month: Date;
  events: CalendarEvent[];
  predictedDates?: Set<string>;
  onDayClick: (date: Date) => void;
  className?: string;
  variant?: 'mobile' | 'desktop';
}

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  month, 
  events, 
  predictedDates, 
  onDayClick, 
  className = '', 
  variant = 'mobile' 
}) => {
  const isDesktop = variant === 'desktop';
  
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getEventForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.find(e => e.date === dateStr);
  };

  const getDayClasses = (day: Date, event?: CalendarEvent) => {
    // Base Structure
    // - aspect-square: Maintains circle shape
    // - Desktop: text-xs (12px) by default, lg:text-sm (14px) on larger screens
    // - Mobile: text-base (16px)
    const baseTextSize = isDesktop ? "text-xs lg:text-sm border-[1.5px]" : "text-base border-2";
    
    let classes = `aspect-square w-full flex items-center justify-center rounded-full font-medium transition-all duration-200 ${baseTextSize} `;
    
    const dateStr = format(day, 'yyyy-MM-dd');
    const isPredicted = predictedDates?.has(dateStr);
    
    // Text Color
    if (!isSameMonth(day, monthStart)) {
      classes += "text-gray-300 ";
    } else {
      classes += "text-gray-800 ";
    }

    // Status Styling
    if (event?.type === 'period') {
      classes += `${PERIOD_COLOR} shadow-md border-transparent`;
    } 
    else if (event?.type === 'ovulation') {
      classes += `${OVULATION_COLOR} shadow-md border-transparent`;
    } 
    else if (isPredicted) {
        classes += "border-dashed border-rose-300 text-rose-500 bg-rose-50";
    }
    else if (isToday(day)) {
        classes += "border-solid border-slate-900";
    }
    else if (isSameMonth(day, monthStart)) {
      classes += "hover:bg-slate-100 border-transparent";
    }
    else {
      classes += "border-transparent";
    }

    return classes;
  };

  return (
    <div className={`w-full ${isDesktop ? 'flex flex-col h-full justify-between' : ''} ${className}`}>
      <h3 className={`font-semibold text-slate-800 capitalize ${isDesktop ? 'text-sm lg:text-base mb-2 pl-1' : 'text-xl mb-4 pl-2'}`}>
        {format(month, 'MMMM')}
      </h3>
      
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className={`text-center font-bold text-gray-400 ${isDesktop ? 'text-[10px] lg:text-xs' : 'text-xs'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      {/* Desktop uses gap-1 to allow shrinking without overflow. Mobile uses comfortable gap-2. */}
      <div className={`grid grid-cols-7 ${isDesktop ? 'gap-0.5 lg:gap-1' : 'gap-2'}`}>
        {days.map((day) => {
          const event = getEventForDay(day);
          return (
            <div key={day.toString()} className="flex justify-center items-center">
              <button
                onClick={() => onDayClick(day)}
                className={getDayClasses(day, event)}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(CalendarMonth);