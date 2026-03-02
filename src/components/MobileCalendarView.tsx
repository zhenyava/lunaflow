import { format } from 'date-fns';
import type { CalendarEvent } from '../types';
import CalendarMonth from './CalendarMonth';

interface MobileCalendarViewProps {
    months: Date[];
    events: CalendarEvent[];
    predictedDates: Set<string>;
    onDayClick: (date: Date) => void;
}

export default function MobileCalendarView({
    months,
    events,
    predictedDates,
    onDayClick
}: MobileCalendarViewProps) {
    return (
        <div className="md:hidden py-8 px-4 min-h-screen">
            {months.map((month) => {
                const headerId = `${format(month, 'yyyy-MM-dd')}-header`;
                return (
                    <div key={month.toString()} id={headerId} className="max-w-md mx-auto mb-8">
                        <CalendarMonth 
                            month={month} 
                            events={events}
                            predictedDates={predictedDates}
                            onDayClick={onDayClick} 
                        />
                    </div>
                )
            })}
             <div className="text-center text-gray-400 text-sm py-10">End of Calendar Range</div>
        </div>
    );
}