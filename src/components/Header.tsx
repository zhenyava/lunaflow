import { useEffect, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, Cloud, CloudOff, WifiOff, ChevronUp, Droplet, Sparkles, Edit3, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { EventType } from '../storage/DailyRecord';
import type { RecordsStore } from '../storage/RecordsStore';
import SettingsModal from './SettingsModal';
interface HeaderProps {
    avgCycleLength: number | null;
    avgPeriodDuration: number | null;
    activeType: EventType;
    setActiveType: (type: EventType) => void;
    isAuthenticated: boolean;
    recordsStore: RecordsStore;
    isOnline: boolean;
    onSync: () => void;
    onLogin: () => void;

    // Settings Props
    isSettingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    selectedProviderId: string;
    onProviderChange: (id: string) => void;
    onLogout: () => void;

    // Edit Mode Props
    isEditMode: boolean;
    setIsEditMode: (edit: boolean) => void;

    // Year Props
    currentYear?: number;
    onPrevYear?: () => void;
    onNextYear?: () => void;
}

interface TypeToggleButtonProps {
    type: EventType;
    label: string;
    icon: LucideIcon;
    colorClass: string;
    activeType: EventType;
    setActiveType: (type: EventType) => void;
}

const TypeToggleButton = ({ type, label, icon: Icon, colorClass, activeType, setActiveType }: TypeToggleButtonProps) => (
    <button
        onClick={() => setActiveType(type)}
        className={`px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-all duration-200 ${
            activeType === type 
            ? `${colorClass} text-white shadow-md` 
            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
        }`}
    >
        <Icon size={16} fill={activeType === type ? "currentColor" : "none"} />
        <span>{label}</span>
    </button>
);

export default function Header({
    avgCycleLength,
    avgPeriodDuration,
    activeType,
    setActiveType,
    isAuthenticated,
    recordsStore,
    isOnline,
    onSync,
    onLogin,
    isSettingsOpen,
    setSettingsOpen,
    selectedProviderId,
    onProviderChange,
    onLogout,
    isEditMode,
    setIsEditMode,
    currentYear,
    onPrevYear,
    onNextYear
}: HeaderProps) {
    const navigate = useNavigate();
    const [, rerender] = useReducer((x: number) => x + 1, 0);
    useEffect(() => recordsStore.subscribeCloudSyncStateChanged(rerender), [recordsStore]);
    const syncState = isOnline ? recordsStore.cloudState : 'offline';

    const getSyncIcon = () => {
        if (syncState === 'offline') {
            return <WifiOff size={20} className="text-amber-500" />;
        }
        if (syncState === 'uploading' || syncState === 'syncing') {
            return <RefreshCw size={20} className="animate-spin text-yellow-500" />;
        }
        if (syncState === 'synced') {
            return <Cloud size={20} className="text-green-500" />;
        }
        // 'unsynced': authenticated with pending upload, or not yet signed in
        if (isAuthenticated) {
            return <Cloud size={20} className="text-amber-400" />;
        }
        return <CloudOff size={20} className="text-gray-400" />;
    };

    return (
        <header className="flex-none bg-white border-b border-gray-100 shadow-sm z-10 px-4 pt-3 pb-1.5 md:pt-4 md:pb-2">
            <div className="max-w-6xl mx-auto">
               <div className="flex justify-between items-center">
                   <div className="flex items-center gap-6">
                       <h1 
                           onClick={() => navigate('/', { state: { fromApp: true } })}
                           className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
                       >
                         LunaFlow
                       </h1>
    
                   {/* Desktop Type Toggles */}
                   <div className="hidden md:flex gap-2">
                        {isEditMode && (
                            <>
                                <TypeToggleButton 
                                    type="period" 
                                    label="Period" 
                                    icon={Droplet} 
                                    colorClass="bg-rose-500" 
                                    activeType={activeType}
                                    setActiveType={setActiveType}
                                />
                                <TypeToggleButton 
                                    type="ovulation" 
                                    label="Ovulation" 
                                    icon={Sparkles} 
                                    colorClass="bg-violet-500" 
                                    activeType={activeType}
                                    setActiveType={setActiveType}
                                />
                            </>
                        )}
                   </div>
                   </div>
                   
                   <div className="flex gap-2 items-center">
                        {/* Compact Year Selector - Desktop only */}
                        {currentYear !== undefined && onPrevYear && onNextYear && (
                            <div className="hidden md:flex items-center bg-slate-50 rounded-full p-0.5 border border-slate-200 mr-2">
                                <button 
                                    onClick={onPrevYear}
                                    className="p-1 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-700 hover:shadow-sm"
                                    aria-label="Previous Year"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-2 text-sm font-bold text-slate-600 tabular-nums min-w-[3.5rem] text-center">
                                    {currentYear}
                                </span>
                                <button 
                                    onClick={onNextYear}
                                    className="p-1 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-700 hover:shadow-sm"
                                    aria-label="Next Year"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                isEditMode 
                                    ? 'bg-slate-800 text-white shadow-sm' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Edit3 size={16} />
                            <span>{isEditMode ? 'Done Editing' : 'Edit Dates'}</span>
                        </button>
                        <button 
                            onClick={() => isAuthenticated ? onSync() : onLogin()}
                            className={`p-2 rounded-full transition-colors ${isAuthenticated ? 'hover:bg-green-50' : 'hover:bg-gray-100'}`}
                            title={isAuthenticated ? "Click to Force Sync" : "Connect Provider"}
                        >
                            {getSyncIcon()}
                        </button>
                        <button 
                            onClick={() => setSettingsOpen(!isSettingsOpen)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                        >
                            <ChevronUp className={`transition-transform duration-200 ${isSettingsOpen ? '' : 'rotate-180'}`} size={20}/>
                        </button>
                   </div>
               </div>

               {/* Stats Row - Rendered separately to avoid pushing other elements and prevent jumping */}
               <div className="h-6 flex items-end">
                   <div className="text-xs text-slate-500 font-medium flex items-center mt-1 gap-2 animate-in fade-in">
                       <div className="flex items-center gap-1">
                           <Activity size={12} className="text-rose-500"/>
                           <span>Cycle: <span className="text-slate-900 font-bold">{avgCycleLength ?? '?'}</span> days</span>
                           <span className="text-slate-300">•</span>
                           <span>Period: <span className="text-slate-900 font-bold">{avgPeriodDuration ?? '?'}</span> days</span>
                       </div>
                   </div>
               </div>
            </div>
    
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setSettingsOpen(false)}
                isAuthenticated={isAuthenticated}
                selectedProviderId={selectedProviderId}
                onProviderChange={onProviderChange}
                onLogin={onLogin}
                onLogout={onLogout}
            />
        </header>
    );
}
