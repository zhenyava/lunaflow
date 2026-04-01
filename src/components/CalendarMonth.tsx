import React from 'react';
import { DayPicker } from 'react-day-picker';
import { parseISO } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { DailyRecord } from '../storage/DailyRecord';

interface CalendarMonthProps {
  month: Date;
  events?: readonly DailyRecord[];
  predictedDates?: Set<string>;
  predictedOvulationDates?: Set<string>;
  onDayClick?: (date: Date) => void;
  selectedDate?: Date | null;
  className?: string;
}

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  month, 
  events = [],
  predictedDates,
  predictedOvulationDates,
  onDayClick,
  selectedDate,
  className = '' 
}) => {
  // Memoize dates calculation to prevent unnecessary work on every render
  const { 
    periodLight, periodMedium, periodHeavy, periodSpotting, 
    ovulationDates, symptomDates, predicted, predictedOvulation
  } = React.useMemo(() => {
    return {
      periodLight: events.filter(e => e.period?.intensity === 'light').map(e => parseISO(e.date)),
      periodMedium: events.filter(e => e.period && (!e.period.intensity || e.period.intensity === 'medium')).map(e => parseISO(e.date)),
      periodHeavy: events.filter(e => e.period?.intensity === 'heavy').map(e => parseISO(e.date)),
      periodSpotting: events.filter(e => e.period?.intensity === 'spotting').map(e => parseISO(e.date)),
      ovulationDates: events.filter(e => !!e.ovulation).map(e => parseISO(e.date)),
      symptomDates: events.filter(e => e.symptoms && Object.keys(e.symptoms).some(k => e.symptoms![k].length > 0)).map(e => parseISO(e.date)),
      predicted: Array.from(predictedDates || []).map(d => parseISO(d)),
      predictedOvulation: Array.from(predictedOvulationDates || []).map(d => parseISO(d))
    };
  }, [events, predictedDates, predictedOvulationDates]);

  return (
    <div className={`w-full h-full min-h-0 flex flex-col ${className}`}>
      <DayPicker
        month={month}
        onMonthChange={() => {}} 
        disableNavigation
        hideNavigation
        onDayClick={onDayClick}
        selected={selectedDate || undefined}
        showOutsideDays
        modifiers={{
          period_light: periodLight,
          period_medium: periodMedium,
          period_heavy: periodHeavy,
          period_spotting: periodSpotting,
          ovulation: ovulationDates,
          has_symptoms: symptomDates,
          predicted: predicted,
          predictedOvulation: predictedOvulation
        }}
        modifiersClassNames={{
          today: "[&_button]:border-2 [&_button]:border-slate-300 [&_button]:font-bold",
          selected: "[&_button]:ring-2 [&_button]:ring-slate-800 [&_button]:ring-offset-2",
          period_light: "[&_button]:bg-rose-300 [&_button]:text-white",
          period_medium: "[&_button]:bg-rose-500 [&_button]:text-white",
          period_heavy: "[&_button]:bg-rose-700 [&_button]:text-white",
          period_spotting: "[&_button]:bg-rose-100 [&_button]:text-rose-700",
          ovulation: "[&_button]:bg-violet-500 [&_button]:text-white",
          has_symptoms: "[&_button]:after:content-[''] [&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:w-1 [&_button]:after:h-1 [&_button]:after:rounded-full [&_button]:after:bg-slate-400",
          predicted: "[&_button]:border-2 [&_button]:border-dashed [&_button]:border-rose-300 [&_button]:text-rose-500 [&_button]:bg-rose-50",
          predictedOvulation: "[&_button]:border-2 [&_button]:border-dashed [&_button]:border-violet-300 [&_button]:text-violet-500 [&_button]:bg-violet-50"
        }}
        components={{
          MonthGrid: (props) => <div {...props} />,
          Weeks: (props) => <div {...props} />,
          Week: (props) => <div {...props} />,
          Day: (props) => <div {...props} />,
          Weekdays: (props) => <div {...props} />,
          Weekday: (props) => <div {...props} />,
        }}
        classNames={{
          root: "w-full h-full flex flex-col p-1 sm:p-2",
          months: "w-full h-full flex flex-col flex-1 min-h-0",
          month: "flex flex-col h-full w-full flex-1",
          caption: "flex justify-center items-center pb-2 flex-none h-[15%]",
          caption_label: "text-sm md:text-base lg:text-lg font-medium text-slate-900",
          month_grid: "w-full flex-1 flex flex-col h-[85%]",
          weekdays: "flex w-full h-[14.28%]",
          weekday: "text-slate-500 w-[14.28%] font-normal text-[10px] md:text-xs uppercase flex items-center justify-center",
          weeks: "flex w-full flex-col h-[85.72%]",
          week: "flex w-full flex-1",
          day: "w-[14.28%] h-full flex items-center justify-center p-0",
          day_button: "relative w-[85%] h-[85%] max-w-[3rem] max-h-[3rem] aspect-square flex items-center justify-center rounded-full text-xs sm:text-sm md:text-base p-0 m-auto",
          outside: "opacity-40 [&_button]:text-slate-400",
        }}
      />
    </div>
  );
};

export default React.memo(CalendarMonth);
