import type { DailyRecord } from '../types';
import CalendarMonth from './CalendarMonth';

interface DesktopCalendarViewProps {
    months: Date[];
    events: readonly DailyRecord[];
    predictedDates: Set<string>;
    predictedOvulationDates: Set<string>;
    onDayClick: (date: Date) => void;
    selectedDate?: Date | null;
}

export default function DesktopCalendarView({
    months,
    events,
    predictedDates,
    predictedOvulationDates,
    onDayClick,
    selectedDate
}: DesktopCalendarViewProps) {
    return (
        <div className="hidden md:flex flex-col h-full py-4 px-4 w-full">
            
            {/* Months Grid (Single Year) */}
            <div className="flex-1 min-h-0 overflow-auto p-4">
                <div className="grid grid-cols-4 grid-rows-3 gap-4 lg:gap-6 w-full h-full max-w-[1400px] min-h-[600px] min-w-[768px] mx-auto">
                    {months.map(month => (
                        <div key={month.toString()} className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center min-h-0 overflow-hidden">
                            <CalendarMonth 
                                month={month} 
                                events={events}
                                predictedDates={predictedDates}
                                predictedOvulationDates={predictedOvulationDates}
                                onDayClick={onDayClick}
                                className="h-full w-full min-h-0"
                                selectedDate={selectedDate}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
