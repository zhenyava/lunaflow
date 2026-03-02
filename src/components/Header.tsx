import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, AlertCircle, Cloud, CloudOff, ChevronUp, Droplet, Sparkles } from 'lucide-react';
import type { SyncState, EventType } from '../types';
import SettingsModal from './SettingsModal';

interface HeaderProps {
    avgCycleLength: number | null;
    avgPeriodDuration: number | null;
    activeType: EventType;
    setActiveType: (type: EventType) => void;
    isAuthenticated: boolean;
    syncState: SyncState;
    onSync: () => void;
    onLogin: () => void;
    
    // Settings Props
    isSettingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    googleClientId: string;
    setGoogleClientId: (id: string) => void;
    onLogout: () => void;
}

interface TypeToggleButtonProps {
    type: EventType;
    label: string;
    icon: React.ElementType;
    colorClass: string;
    activeType: EventType;
    setActiveType: (type: EventType) => void;
}

const TypeToggleButton = ({ type, label, icon: Icon, colorClass, activeType, setActiveType }: TypeToggleButtonProps) => (
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

export default function Header({
    avgCycleLength,
    avgPeriodDuration,
    activeType,
    setActiveType,
    isAuthenticated,
    syncState,
    onSync,
    onLogin,
    isSettingsOpen,
    setSettingsOpen,
    googleClientId,
    setGoogleClientId,
    onLogout
}: HeaderProps) {
    const navigate = useNavigate();

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

    return (
        <header className="flex-none bg-white border-b border-gray-100 shadow-sm z-10 px-4 pt-3 pb-1.5 md:pt-4 md:pb-2">
            <div className="max-w-6xl mx-auto">
               <div className="flex justify-between items-center">
                   <div className="flex items-center gap-6">
                       <h1 
                           onClick={() => navigate('/home')}
                           className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
                       >
                         LunaFlow
                       </h1>
    
                   {/* Desktop Type Toggles */}
                   <div className="hidden md:flex gap-2">
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
                   </div>
                   </div>
                   
                   <div className="flex gap-2 items-center">
                        <button 
                            onClick={() => isAuthenticated ? onSync() : onLogin()}
                            className={`p-2 rounded-full transition-colors ${isAuthenticated ? 'hover:bg-green-50' : 'hover:bg-gray-100'}`}
                            title={isAuthenticated ? "Click to Force Sync" : "Connect Google Drive"}
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
                googleClientId={googleClientId}
                setGoogleClientId={setGoogleClientId}
                onLogin={onLogin}
                onLogout={onLogout}
            />
        </header>
    );
}
