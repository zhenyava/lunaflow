import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '../types';
import CalendarMonth from './CalendarMonth';

interface DesktopCalendarViewProps {
    currentYear: number;
    onPrevYear: () => void;
    onNextYear: () => void;
    months: Date[];
    events: CalendarEvent[];
    predictedDates: Set<string>;
    onDayClick: (date: Date) => void;
}

export default function DesktopCalendarView({
    currentYear,
    onPrevYear,
    onNextYear,
    months,
    events,
    onDayClick
}: DesktopCalendarViewProps) {
    return (
        <div className="hidden md:flex flex-col h-full py-4 px-4 w-full">
            
            {/* Year Navigation - fixed height */}
            <div className="flex-none flex items-center justify-between mb-4 max-w-sm mx-auto bg-white rounded-full shadow-sm border border-gray-200 p-1 w-full">
                <button 
                    onClick={onPrevYear}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                    aria-label="Previous Year"
                >
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-slate-800 tabular-nums">
                    {currentYear}
                </h2>
                <button 
                    onClick={onNextYear}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                    aria-label="Next Year"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Months Grid (Single Year) */}
            <div className="flex-1 min-h-0 flex justify-center items-center">
                <div className="grid grid-cols-4 grid-rows-3 gap-x-6 gap-y-4 h-full w-auto max-w-full aspect-[4/3]">
                    {months.map(month => (
                        <div key={month.toString()} className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                            <CalendarMonth 
                                month={month} 
                                events={events}
                                onDayClick={onDayClick}
                                className="h-full w-full"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}