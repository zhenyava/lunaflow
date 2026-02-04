import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { addMonths, format, subMonths, eachMonthOfInterval, startOfMonth, endOfYear, max } from 'date-fns';
import { Droplet, Sparkles, Cloud, CloudOff, RefreshCw, ChevronUp, ChevronLeft, ChevronRight, Activity, AlertCircle } from 'lucide-react';
import { CalendarEvent, EventType, SyncState, GoogleToken } from './types';
import { getLocalEvents, saveLocalEvents, mergeEvents } from './services/storageService';
import { 
  initializeGoogleApi, 
  signInToGoogle, 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  revokeToken,
  restoreGapiSession
} from './services/googleService';
import { calculateAverageCycleLength, predictFuturePeriods } from './services/statsService';
import { GOOGLE_CLIENT_ID } from './constants';
import CalendarMonth from './components/CalendarMonth';

// Generate a range of months for the Mobile "Infinite" list
const INITIAL_START_DATE = subMonths(startOfMonth(new Date()), 12);
const INITIAL_END_DATE = addMonths(startOfMonth(new Date()), 12);

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // Mobile uses a long list of months
  const [mobileMonths, setMobileMonths] = useState<Date[]>([]);
  
  // Desktop uses a single year view
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const [activeType, setActiveType] = useState<EventType>('period');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [configOpen, setConfigOpen] = useState(false);
  const [isApiInitialized, setIsApiInitialized] = useState(false);
  
  // Use Client ID from constants or fallback to local storage
  const [googleClientId, setGoogleClientId] = useState(() => {
     return GOOGLE_CLIENT_ID || localStorage.getItem('LUNA_GOOGLE_CLIENT_ID') || '';
  });

  // 1. Load Local Data & Setup Mobile Calendar
  useEffect(() => {
    const local = getLocalEvents();
    setEvents(local);
    const monthList = eachMonthOfInterval({ start: INITIAL_START_DATE, end: INITIAL_END_DATE });
    setMobileMonths(monthList);
  }, []);

  // 2. Init Google API
  useEffect(() => {
    if (googleClientId) {
      initializeGoogleApi(googleClientId, (success) => {
        if (success) {
           console.log("Google API Initialized");
           setIsApiInitialized(true);
        }
      });
    }
  }, [googleClientId]);

  // 3. Token-based Session Restore
  useEffect(() => {
    if (isApiInitialized && !isAuthenticated) {
        try {
            const storedTokenStr = localStorage.getItem('LUNA_AUTH_TOKEN');
            if (storedTokenStr) {
                const token: GoogleToken = JSON.parse(storedTokenStr);
                const now = Date.now();
                
                if (token.expires_at && token.expires_at > now + 60000) {
                    restoreGapiSession(token);
                    setIsAuthenticated(true);
                    ensureDriveFileExists()
                        .then(id => {
                            setDriveFileId(id);
                            performFullSync(id);
                        })
                        .catch(err => {
                            handleLogout();
                        });
                } else {
                    localStorage.removeItem('LUNA_AUTH_TOKEN');
                    setIsAuthenticated(false);
                    setSyncState({ status: 'idle' });
                }
            }
        } catch (e) {
            localStorage.removeItem('LUNA_AUTH_TOKEN');
        }
    }
  }, [isApiInitialized]);

  // 4. CORE SYNCHRONIZATION LOGIC
  const performFullSync = async (fileId: string) => {
    if (!fileId) return;
    setSyncState({ status: 'syncing' });
    try {
        const remoteEvents = await fetchDriveDataContent(fileId);
        const localEvents = events; 
        const merged = mergeEvents(localEvents, remoteEvents);
        
        const isLocalDifferent = JSON.stringify(merged) !== JSON.stringify(localEvents);
        if (isLocalDifferent) {
             setEvents(merged);
             saveLocalEvents(merged);
        }

        const isRemoteDifferent = JSON.stringify(merged) !== JSON.stringify(remoteEvents);
        if (isRemoteDifferent) {
             await uploadDriveData(fileId, merged);
        }

        setSyncState({ status: 'success', lastSynced: new Date() });
    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.status === 401) {
            handleLogout();
        } else {
            setSyncState({ status: 'error' });
        }
    }
  };

  // 5. Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isAuthenticated && driveFileId && syncState.status !== 'syncing') {
              performFullSync(driveFileId);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, driveFileId, events, syncState.status]);

  // 6. Save to Local Storage immediately
  useEffect(() => {
    saveLocalEvents(events);
  }, [events]);

  // 7. Debounced Auto-Save
  useEffect(() => {
    if (!isAuthenticated || !driveFileId) return;
    if (syncState.status === 'success' && Date.now() - (syncState.lastSynced?.getTime() || 0) < 2000) return;

    setSyncState({ status: 'syncing' });
    const timeoutId = setTimeout(async () => {
        try {
            await uploadDriveData(driveFileId, events);
            setSyncState({ status: 'success', lastSynced: new Date() });
        } catch (error: any) {
             if (error.message === 'Unauthorized' || error.status === 401) {
                handleLogout();
            } else {
                setSyncState({ status: 'error' });
            }
        }
    }, 2000); 

    return () => clearTimeout(timeoutId);
  }, [events, isAuthenticated, driveFileId]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setEvents(prev => {
      const existingIndex = prev.findIndex(e => e.date === dateStr);
      let newEvents = [...prev];
      if (existingIndex >= 0) {
        const existing = newEvents[existingIndex];
        if (existing.type === activeType) {
            newEvents.splice(existingIndex, 1);
        } else {
            newEvents[existingIndex] = { ...existing, type: activeType };
        }
      } else {
        newEvents.push({ date: dateStr, type: activeType });
      }
      return newEvents;
    });
  }, [activeType]);

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      const input = prompt("Google Client ID is required.");
      if (input && input.trim()) {
        const newId = input.trim();
        localStorage.setItem('LUNA_GOOGLE_CLIENT_ID', newId);
        setGoogleClientId(newId);
        alert("Client ID saved! Please click sync again.");
      }
      return;
    }
    
    try {
      setSyncState({ status: 'syncing' });
      const tokenResponse = await signInToGoogle(true);
      if (tokenResponse && tokenResponse.expires_in) {
          const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
          const tokenToStore: GoogleToken = { ...tokenResponse, expires_at: expiresAt };
          localStorage.setItem('LUNA_AUTH_TOKEN', JSON.stringify(tokenToStore));
      }
      const fileId = await ensureDriveFileExists();
      setDriveFileId(fileId);
      setIsAuthenticated(true);
      await performFullSync(fileId);

    } catch (error: any) {
      setSyncState({ status: 'error' });
      setIsAuthenticated(false);
      localStorage.removeItem('LUNA_AUTH_TOKEN');
      let errorMessage = "Login failed.";
      if (error?.message) errorMessage = error.message;
      alert(errorMessage);
    }
  };

  const handleLogout = () => {
      revokeToken();
      setIsAuthenticated(false);
      setDriveFileId(null);
      setSyncState({ status: 'idle' });
      localStorage.removeItem('LUNA_AUTH_TOKEN');
  };

  const resetClientId = () => {
      if(confirm("Reset stored Google Client ID?")) {
          localStorage.removeItem('LUNA_GOOGLE_CLIENT_ID');
          localStorage.removeItem('LUNA_AUTH_TOKEN');
          setGoogleClientId('');
          window.location.reload();
      }
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        // Mobile scroll logic: scroll to current month on load
        const currentMonthStart = startOfMonth(new Date());
        const currentId = `${format(currentMonthStart, 'yyyy-MM-dd')}-header`;
        const el = document.getElementById(currentId);
        if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [mobileMonths]);

  // Statistics & Predictions
  const avgCycleLength = useMemo(() => calculateAverageCycleLength(events), [events]);
  
  // Calculate predictions. Ensure we cover the desktop view year even if it's far in future
  const predictedDates = useMemo(() => {
    const endOfCurrentDesktopYear = endOfYear(new Date(currentYear, 0, 1));
    // Use the further date between mobile default range and selected desktop year
    const limit = max([INITIAL_END_DATE, endOfCurrentDesktopYear]);
    return predictFuturePeriods(events, avgCycleLength, limit);
  }, [events, avgCycleLength, currentYear]);

  // Desktop: Generate months for the selected year
  const desktopMonths = useMemo(() => {
      return eachMonthOfInterval({
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 11, 31)
      });
  }, [currentYear]);

  const handlePrevYear = () => setCurrentYear(y => y - 1);
  const handleNextYear = () => setCurrentYear(y => y + 1);

  const getSyncIcon = () => {
      if (syncState.status === 'syncing') {
          return <RefreshCw size={20} className="animate-spin text-yellow-500" />;
      }
      if (syncState.status === 'error') {
          return <AlertCircle size={20} className="text-red-500" />;
      }
      if (isAuthenticated) {
          return <Cloud size={20} className="text-green-500" />;
      }
      return <CloudOff size={20} className="text-gray-400" />;
  };

  const TypeToggleButton = ({ type, label, icon: Icon, colorClass }: any) => (
      <button
          onClick={() => setActiveType(type)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm transition-all duration-200 ${
              activeType === type 
              ? `${colorClass} text-white shadow-md` 
              : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
          }`}
      >
          <Icon size={16} fill={activeType === type ? "currentColor" : "none"} />
          {label}
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-100 shadow-sm z-10 px-4 py-3 md:py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
           <div className="flex items-center gap-6">
               <div className="flex flex-col">
                   <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
                     LunaFlow
                   </h1>
                   {avgCycleLength && (
                       <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                           <Activity size={12} className="text-rose-500"/>
                           <span>Avg Cycle: <span className="text-slate-900 font-bold">{avgCycleLength}</span> days</span>
                       </div>
                   )}
               </div>

               {/* Desktop Type Toggles */}
               <div className="hidden md:flex gap-2">
                    <TypeToggleButton type="period" label="Period" icon={Droplet} colorClass="bg-rose-500" />
                    <TypeToggleButton type="ovulation" label="Ovulation" icon={Sparkles} colorClass="bg-violet-500" />
               </div>
           </div>
           
           <div className="flex gap-2 items-center">
                <button 
                    onClick={() => isAuthenticated ? performFullSync(driveFileId!) : handleGoogleLogin()}
                    className={`p-2 rounded-full transition-colors ${isAuthenticated ? 'hover:bg-green-50' : 'hover:bg-gray-100'}`}
                    title={isAuthenticated ? "Click to Force Sync" : "Connect Google Drive"}
                >
                    {getSyncIcon()}
                </button>
                <button 
                    onClick={() => setConfigOpen(!configOpen)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                    <ChevronUp className={`transition-transform duration-200 ${configOpen ? '' : 'rotate-180'}`} size={20}/>
                </button>
           </div>
        </div>

        {configOpen && (
            <div className="max-w-md mx-auto mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm animate-in slide-in-from-top-2 absolute left-0 right-0 md:relative md:left-auto md:right-auto shadow-xl md:shadow-none z-50 md:z-auto">
                 <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Cloud Backup</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${isAuthenticated ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {isAuthenticated ? 'Active' : 'Disabled'}
                    </span>
                 </div>
                 <div className="text-xs text-gray-400 mt-2 mb-2">
                    {isAuthenticated 
                        ? syncState.lastSynced ? `Last synced: ${format(syncState.lastSynced, 'HH:mm:ss')}` : 'Syncing...'
                        : 'Connect to Google Drive to backup your cycle data securely.'
                    }
                 </div>
                 <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <button onClick={resetClientId} className="text-gray-400 hover:text-gray-600 text-xs">Reset Client ID</button>
                    {isAuthenticated && (
                        <button onClick={handleLogout} className="text-red-500 hover:text-red-600 text-xs font-medium">Disconnect</button>
                    )}
                 </div>
            </div>
        )}
      </header>

      {/* Main Content Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative bg-white md:bg-slate-50">
        
        {/* MOBILE VIEW: Vertical List (Infinite Scroll Feel) */}
        <div className="md:hidden py-8 px-4 min-h-screen">
            {mobileMonths.map((month) => {
                const headerId = `${format(month, 'yyyy-MM-dd')}-header`;
                return (
                    <div key={month.toString()} id={headerId} className="max-w-md mx-auto mb-8">
                        <CalendarMonth 
                            month={month} 
                            events={events} 
                            predictedDates={predictedDates}
                            onDayClick={handleDayClick} 
                        />
                    </div>
                )
            })}
             <div className="text-center text-gray-400 text-sm py-10">End of Calendar Range</div>
        </div>

        {/* DESKTOP VIEW: Single Year with Responsive "Contain" Layout */}
        <div className="hidden md:flex flex-col h-full py-4 px-4 w-full">
            
            {/* Year Navigation - fixed height */}
            <div className="flex-none flex items-center justify-between mb-4 max-w-sm mx-auto bg-white rounded-full shadow-sm border border-gray-200 p-1 w-full">
                <button 
                    onClick={handlePrevYear}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                    aria-label="Previous Year"
                >
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-slate-800 tabular-nums">
                    {currentYear}
                </h2>
                <button 
                    onClick={handleNextYear}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                    aria-label="Next Year"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Months Grid (Single Year) 
                Layout Strategy: 
                - flex-1 min-h-0: Allows the container to fill available height but shrink if needed.
                - flex justify-center: Centers the grid horizontally.
                - The Grid itself: 
                   - h-full: Force it to be as tall as the container.
                   - aspect-[4/3]: Enforce the shape of a 4x3 grid.
                   - max-w-full: Prevent horizontal overflow if the calculated width (from height + aspect) is too wide.
                   - w-auto: Let width be derived from height + aspect-ratio.
                   - grid-cols-4: Fixed 4 columns to match aspect ratio.
                   This effectively mimics "object-fit: contain" for the grid.
            */}
            <div className="flex-1 min-h-0 flex justify-center items-center">
                <div className="grid grid-cols-4 grid-rows-3 gap-x-6 gap-y-4 h-full w-auto max-w-full aspect-[4/3]">
                    {desktopMonths.map(month => (
                        <div key={month.toString()} className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                            <CalendarMonth 
                                month={month} 
                                events={events} 
                                predictedDates={predictedDates}
                                onDayClick={handleDayClick}
                                className="h-full w-full"
                                variant="desktop"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </main>

      {/* Footer (Mobile Only) */}
      <footer className="md:hidden flex-none bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 pb-8 safe-area-pb">
         <div className="max-w-md mx-auto flex gap-4">
            <button
                onClick={() => setActiveType('period')}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all duration-200 ${
                    activeType === 'period' 
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-105' 
                    : 'bg-rose-50 text-rose-400 hover:bg-rose-100'
                }`}
            >
                <Droplet size={18} fill={activeType === 'period' ? "currentColor" : "none"} />
                Period
            </button>
            <button
                onClick={() => setActiveType('ovulation')}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all duration-200 ${
                    activeType === 'ovulation' 
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-200 scale-105' 
                    : 'bg-violet-50 text-violet-400 hover:bg-violet-100'
                }`}
            >
                <Sparkles size={18} fill={activeType === 'ovulation' ? "currentColor" : "none"} />
                Ovulation
            </button>
         </div>
      </footer>
    </div>
  );
}

export default App;