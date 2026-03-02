import { useState, useEffect, useRef, useMemo } from 'react';
import { addMonths, format, subMonths, eachMonthOfInterval, startOfMonth } from 'date-fns';
import Header from './Header';
import MobileCalendarView from './MobileCalendarView';
import DesktopCalendarView from './DesktopCalendarView';
import MobileControls from './MobileControls';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useGoogleSync } from '../hooks/useGoogleSync';
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

  // Custom Hooks
  const { 
    events, 
    setEvents, 
    activeType, 
    setActiveType, 
    handleDayClick 
  } = useCalendarEvents();

  const {
    isAuthenticated,
    syncState,
    googleClientId,
    setGoogleClientId,
    handleGoogleLogin,
    handleLogout,
    performFullSync,
    driveFileId
  } = useGoogleSync({ 
      events, 
      setEvents
  });

  // Statistics & Predictions
  const { avgCycleLength, avgPeriodDuration, predictedDates } = useCycleStats(events, currentYear);

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

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <Header 
        avgCycleLength={avgCycleLength}
        avgPeriodDuration={avgPeriodDuration}
        activeType={activeType}
        setActiveType={setActiveType}
        isAuthenticated={isAuthenticated}
        syncState={syncState}
        onSync={() => driveFileId && performFullSync(driveFileId)}
        onLogin={handleGoogleLogin}
        isSettingsOpen={isSettingsOpen}
        setSettingsOpen={setSettingsOpen}
        googleClientId={googleClientId}
        setGoogleClientId={setGoogleClientId}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative bg-white md:bg-slate-50">
        
        <MobileCalendarView 
            months={mobileMonths}
            events={events}
            predictedDates={predictedDates}
            onDayClick={handleDayClick}
        />

        <DesktopCalendarView 
            currentYear={currentYear}
            onPrevYear={handlePrevYear}
            onNextYear={handleNextYear}
            months={desktopMonths}
            events={events}
            predictedDates={predictedDates}
            onDayClick={handleDayClick}
        />
      </main>

      <MobileControls 
        activeType={activeType}
        setActiveType={setActiveType}
      />
    </div>
  );
}

export default CalendarApp;
