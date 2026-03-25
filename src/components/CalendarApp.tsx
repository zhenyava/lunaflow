import { useState, useEffect, useRef, useMemo } from 'react';
import { addMonths, format, subMonths, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { Edit3 } from 'lucide-react';
import Header from './Header';
import MobileCalendarView from './MobileCalendarView';
import DesktopCalendarView from './DesktopCalendarView';
import MobileControls from './MobileControls';
import DayDetailsPanel from './DayDetailsPanel';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useRemoteSync } from '../hooks/useRemoteSync';
import { useCycleStats } from '../hooks/useCycleStats';

// Generate a range of months for the Mobile "Infinite" list
const INITIAL_START_DATE = subMonths(startOfMonth(new Date()), 12);
const INITIAL_END_DATE = addMonths(startOfMonth(new Date()), 12);

function CalendarApp() {
  // Mobile uses a long list of months
  const [mobileMonths] = useState<Date[]>(() => 
    eachMonthOfInterval({ start: INITIAL_START_DATE, end: INITIAL_END_DATE })
  );
  
  // Desktop uses a single year view
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Config State for UI (Settings Modal)
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Custom Hooks
  const { 
    events,         // Filtered (isDeleted: false)
    allRecords,     // Full (includes tombstones)
    setEvents,      // Updater (affects allRecords)
    activeType, 
    setActiveType, 
    handleDayClick,
    updateRecord
  } = useCalendarEvents();

  const {
    isAuthenticated,
    syncState,
    googleClientId,
    setGoogleClientId,
    handleLogin,
    handleLogout,
    performFullSync,
    remoteFileId
  } = useRemoteSync({ 
      events: allRecords, // Pass raw records for sync
      setEvents
  });

  // Statistics & Predictions use cleaned events
  const { avgCycleLength, avgPeriodDuration, predictedDates, predictedOvulationDates } = useCycleStats(events, currentYear);

  // Desktop: Generate months for the selected year
  const desktopMonths = useMemo(() => {
      return eachMonthOfInterval({
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 11, 31)
      });
  }, [currentYear]);

  const handlePrevYear = () => setCurrentYear(y => y - 1);
  const handleNextYear = () => setCurrentYear(y => y + 1);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        const currentMonthStart = startOfMonth(new Date());
        const currentId = `${format(currentMonthStart, 'yyyy-MM-dd')}-header`;
        const el = document.getElementById(currentId);
        if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [mobileMonths]);

  // Scroll to selected day on mobile so it's not hidden by the bottom sheet
  useEffect(() => {
    if (selectedDate && !isEditMode && window.innerWidth < 768) {
      // Small delay to allow the bottom padding to be applied and render
      setTimeout(() => {
        const selectedEl = document.querySelector('.rdp-day_selected');
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 50);
    }
  }, [selectedDate, isEditMode]);

  const onDayClick = (date: Date) => {
    if (isEditMode) {
      handleDayClick(date);
    } else {
      setSelectedDate(date);
    }
  };

  const selectedRecord = useMemo(() => {
    if (!selectedDate) return undefined;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return events.find(e => e.date === dateStr);
  }, [selectedDate, events]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      <Header 
        avgCycleLength={avgCycleLength}
        avgPeriodDuration={avgPeriodDuration}
        activeType={activeType}
        setActiveType={setActiveType}
        isAuthenticated={isAuthenticated}
        syncState={syncState}
        onSync={() => remoteFileId && performFullSync(remoteFileId)}
        onLogin={handleLogin}
        isSettingsOpen={isSettingsOpen}
        setSettingsOpen={setSettingsOpen}
        googleClientId={googleClientId}
        setGoogleClientId={setGoogleClientId}
        onLogout={handleLogout}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        currentYear={currentYear}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        <main ref={scrollRef} className={`flex-1 overflow-y-auto no-scrollbar scroll-smooth relative bg-white md:bg-slate-50 ${selectedDate ? 'pb-[40vh] md:pb-0' : ''}`}>
          
          <MobileCalendarView 
              months={mobileMonths}
              events={events} // UI uses cleaned events
              predictedDates={predictedDates}
              predictedOvulationDates={predictedOvulationDates}
              onDayClick={onDayClick}
              selectedDate={selectedDate}
          />

          <DesktopCalendarView 
              months={desktopMonths}
              events={events} // UI uses cleaned events
              predictedDates={predictedDates}
              predictedOvulationDates={predictedOvulationDates}
              onDayClick={onDayClick}
              selectedDate={selectedDate}
          />
        </main>

        {/* Desktop Side Panel */}
        {selectedDate && (
          <div className="hidden md:block w-80 border-l border-slate-200 bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20">
            <DayDetailsPanel 
              date={selectedDate}
              record={selectedRecord}
              onClose={() => setSelectedDate(null)}
              onUpdate={updateRecord}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      {selectedDate && (
        <div className="md:hidden">
          <div 
            className="fixed inset-0 bg-black/20 z-40 animate-in fade-in"
            onClick={() => setSelectedDate(null)}
          />
          <DayDetailsPanel 
            date={selectedDate}
            record={selectedRecord}
            onClose={() => setSelectedDate(null)}
            onUpdate={updateRecord}
          />
        </div>
      )}

      {/* Mobile Floating Action Button */}
      {!selectedDate && !isEditMode && (
        <div className="md:hidden fixed bottom-6 left-0 right-0 px-4 z-30 flex justify-center pointer-events-none animate-in slide-in-from-bottom-4 fade-in">
          <button
            onClick={() => setIsEditMode(true)}
            className="pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium shadow-lg bg-slate-800 text-white shadow-slate-200/50 transition-transform active:scale-95"
          >
            <Edit3 size={18} />
            <span>Edit Dates</span>
          </button>
        </div>
      )}

      {isEditMode && (
        <MobileControls 
          activeType={activeType}
          setActiveType={setActiveType}
          onDone={() => setIsEditMode(false)}
        />
      )}
    </div>
  );
}

export default CalendarApp;
