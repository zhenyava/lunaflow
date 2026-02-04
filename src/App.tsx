import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { addMonths, format, subMonths, eachMonthOfInterval, startOfMonth, endOfYear, max } from 'date-fns';
import { Droplet, Sparkles, Cloud, CloudOff, RefreshCw, ChevronUp, ChevronLeft, ChevronRight, Activity, AlertCircle, MessageSquare, X, Settings } from 'lucide-react';
import type { CalendarEvent, EventType, SyncState, GoogleToken } from './types';
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
import { GOOGLE_CLIENT_ID, FOLDER_NAME } from './constants';
import CalendarMonth from './components/CalendarMonth';
import LandingPage from './components/LandingPage';

// Generate a range of months for the Mobile "Infinite" list
const INITIAL_START_DATE = subMonths(startOfMonth(new Date()), 12);
const INITIAL_END_DATE = addMonths(startOfMonth(new Date()), 12);

const LAUNCHED_KEY = 'lunaflow_has_launched';

function App() {
  // Navigation State
  const [showLanding, setShowLanding] = useState(true);

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
  
  // Config State
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Use Client ID from constants or fallback to local storage
  const [googleClientId, setGoogleClientId] = useState(() => {
     return GOOGLE_CLIENT_ID || localStorage.getItem('LUNA_GOOGLE_CLIENT_ID') || '';
  });

  // 1. Check for Landing Page / First Launch
  useEffect(() => {
      const hasLaunched = localStorage.getItem(LAUNCHED_KEY);
      const localEvents = getLocalEvents();
      // If user has data or explicitly launched before, skip landing
      if (hasLaunched || localEvents.length > 0) {
          setShowLanding(false);
      }
  }, []);

  const handleStartApp = () => {
      localStorage.setItem(LAUNCHED_KEY, 'true');
      setShowLanding(false);
  };

  // 2. Load Local Data & Setup Mobile Calendar
  useEffect(() => {
    const local = getLocalEvents();
    setEvents(local);
    const monthList = eachMonthOfInterval({ start: INITIAL_START_DATE, end: INITIAL_END_DATE });
    setMobileMonths(monthList);
  }, []);

  // 3. Init Google API
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

  // 4. Token-based Session Restore
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
                            // If we restore a session, also ensure we skip landing in future
                            localStorage.setItem(LAUNCHED_KEY, 'true');
                            setShowLanding(false);
                        })
                        .catch(() => {
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

  // 5. CORE SYNCHRONIZATION LOGIC
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

  // 6. Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isAuthenticated && driveFileId && syncState.status !== 'syncing') {
              performFullSync(driveFileId);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, driveFileId, events, syncState.status]);

  // 7. Save to Local Storage immediately
  useEffect(() => {
    saveLocalEvents(events);
  }, [events]);

  // 8. Debounced Auto-Save
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
      alert("Please enter a Google Client ID in the settings first.");
      setConfigOpen(true);
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
      // Ensure landing is dismissed if they login
      handleStartApp();
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
      if(confirm("Reset all settings?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only scroll if NOT showing landing page
    if (!showLanding && scrollRef.current) {
        const currentMonthStart = startOfMonth(new Date());
        const currentId = `${format(currentMonthStart, 'yyyy-MM-dd')}-header`;
        const el = document.getElementById(currentId);
        if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [mobileMonths, showLanding]);

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

  // Conditional Rendering
  if (showLanding) {
      return <LandingPage onStart={handleStartApp} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      
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
            <div className="max-w-md mx-auto mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm animate-in slide-in-from-top-2 absolute left-0 right-0 md:relative md:left-auto md:right-auto shadow-xl md:shadow-none z-50 md:z-auto max-h-[85vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-gray-700">App Settings</span>
                    <button onClick={() => setConfigOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                 </div>

                 {/* Google Sync Section */}
                 <div className="bg-white p-3 rounded-lg border border-gray-100 mb-3 shadow-sm">
                     <div className="flex items-center gap-2 mb-2">
                         <Cloud size={16} className="text-blue-500"/>
                         <h3 className="font-medium text-gray-800">Google Backup</h3>
                     </div>
                     <p className="text-xs text-gray-500 mb-3">Sync your data to a folder named "{FOLDER_NAME}" in your Google Drive.</p>
                     
                     {!isAuthenticated ? (
                         <div className="space-y-2">
                             {!googleClientId && (
                                 <input 
                                    type="text" 
                                    placeholder="Enter Google Client ID" 
                                    className="w-full text-xs p-2 border rounded"
                                    onChange={(e) => {
                                        setGoogleClientId(e.target.value);
                                        localStorage.setItem('LUNA_GOOGLE_CLIENT_ID', e.target.value);
                                    }}
                                    value={googleClientId}
                                 />
                             )}
                             <button onClick={handleGoogleLogin} className="w-full bg-blue-500 text-white py-2 rounded text-xs font-bold hover:bg-blue-600">
                                 Connect Google Drive
                             </button>
                         </div>
                     ) : (
                         <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100">
                             <span className="text-xs text-green-700 font-medium">Synced</span>
                             <button onClick={handleLogout} className="text-xs text-red-500 font-medium">Disconnect</button>
                         </div>
                     )}
                 </div>

                 {/* Navigation Links */}
                 <div className="space-y-1 mb-3">
                     <a 
                         href="mailto:support@lunaflow.app?subject=LunaFlow%20Feedback"
                         className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors group"
                     >
                         <MessageSquare size={16} className="text-slate-400 group-hover:text-rose-500" />
                         <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">Send Direct Feedback</span>
                     </a>
                 </div>

                 {/* Advanced Toggle */}
                 <div className="border-t border-gray-100 pt-2">
                     <button 
                        onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2 w-full"
                     >
                         <Settings size={12} />
                         {showAdvancedConfig ? 'Hide Advanced Config' : 'Show Advanced Config'}
                     </button>

                     {showAdvancedConfig && (
                         <div className="bg-slate-50 p-3 rounded text-xs space-y-2 animate-in slide-in-from-top-1">
                             <button onClick={resetClientId} className="w-full text-red-400 hover:text-red-500 mt-2 text-[10px]">
                                 Reset Application Data
                             </button>
                         </div>
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

            {/* Months Grid (Single Year) */}
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