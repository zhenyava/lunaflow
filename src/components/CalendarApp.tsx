import { useState, useEffect, useRef, useMemo, useReducer, useCallback } from 'react';
import { addMonths, format, subMonths, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { Edit3 } from 'lucide-react';
import Header from './Header';
import MobileCalendarView from './MobileCalendarView';
import DesktopCalendarView from './DesktopCalendarView';
import MobileControls from './MobileControls';
import DayDetailsPanel from './DayDetailsPanel';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useCycleStats } from '../hooks/useCycleStats';
import { GoogleAuthProvider } from '../auth/GoogleAuthProvider';
import { GoogleDriveProvider } from '../storageProviders/GoogleDriveProvider';
import { StorageProviderRegistry } from '../storageProviders/StorageProviderRegistry';
import { RecordsStore } from '../store/RecordsStore';

// Generate a range of months for the Mobile "Infinite" list
const INITIAL_START_DATE = subMonths(startOfMonth(new Date()), 12);
const INITIAL_END_DATE = addMonths(startOfMonth(new Date()), 12);

function CalendarApp() {
  // Singleton instances — created once per mount
  const authProvider = useMemo(() => new GoogleAuthProvider(), []);
  const registry = useMemo(() => {
    const r = new StorageProviderRegistry();
    r.registerProvider({ id: 'google-drive', name: 'Google Drive' });
    return r;
  }, []);
  const recordsStore = useMemo(() => new RecordsStore(), []);

  // React bridge: re-render when store or auth changes
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  // Lifecycle: init store, initialize auth, connect remote if authenticated
  useEffect(() => {
    recordsStore.init();

    authProvider.initialize().then(async () => {
      if (!authProvider.isAuthenticated()) return;
      try {
        const provider = new GoogleDriveProvider(() => authProvider.getToken());
        await recordsStore.connectRemote(provider);
      } catch (e) {
        console.error('Failed to connect remote', e);
        await authProvider.signOut();
      }
    });

    const unsubStore = recordsStore.subscribe(rerender);
    const unsubAuth = authProvider.onAuthStateChange(() => rerender());
    const unsubRegistry = registry.subscribe(rerender);

    return () => {
      recordsStore.destroy();
      unsubStore();
      unsubAuth();
      unsubRegistry();
    };
  }, [authProvider, recordsStore, registry]);

  // Auth actions
  const handleLogin = useCallback(async () => {
    await authProvider.signIn();
  }, [authProvider]);

  const handleLogout = useCallback(async () => {
    recordsStore.disconnectRemote();
    await authProvider.signOut();
  }, [authProvider, recordsStore]);

  const forceSync = useCallback(() => {
    recordsStore.forceSync();
  }, [recordsStore]);

  const handleProviderChange = useCallback((id: string) => {
    recordsStore.disconnectRemote();
    if (authProvider.isAuthenticated()) authProvider.signOut();
    registry.setActiveProvider(id);
  }, [authProvider, recordsStore, registry]);

  const isAuthenticated = authProvider.isAuthenticated();
  const cloudState = recordsStore.cloudState;
  const selectedProviderId = registry.activeProviderId;
  const allProviders = registry.getAllProviders();

  // Domain mutations hook
  const { events, activeType, setActiveType, handleDayClick, updateRecord } = useCalendarEvents(recordsStore);

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

  // Environment awareness: CalendarApp owns online/offline/focus detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); forceSync(); };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => forceSync();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [forceSync]);

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
        syncState={isOnline ? cloudState : 'unsynced'}
        onSync={() => isAuthenticated && forceSync()}
        onLogin={handleLogin}
        isSettingsOpen={isSettingsOpen}
        setSettingsOpen={setSettingsOpen}
        selectedProviderId={selectedProviderId}
        allProviders={allProviders}
        onProviderChange={handleProviderChange}
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
