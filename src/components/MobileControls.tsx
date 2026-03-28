import { Droplet, Sparkles, Check } from 'lucide-react';
import type { EventType } from '../storage/DailyRecord';

interface MobileControlsProps {
    activeType: EventType;
    setActiveType: (type: EventType) => void;
    onDone: () => void;
}

export default function MobileControls({ activeType, setActiveType, onDone }: MobileControlsProps) {
    return (
        <footer className="md:hidden flex-none bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 pb-8 safe-area-pb shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
            <div className="max-w-md mx-auto flex flex-col gap-3">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveType('period')}
                        className={`flex-1 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 ${
                            activeType === 'period' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-105' 
                            : 'bg-rose-50 text-rose-400 hover:bg-rose-100'
                        }`}
                    >
                        <Droplet size={20} fill={activeType === 'period' ? "currentColor" : "none"} />
                        <span>Period</span>
                    </button>
                    <button
                        onClick={() => setActiveType('ovulation')}
                        className={`flex-1 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 ${
                            activeType === 'ovulation' 
                            ? 'bg-violet-500 text-white shadow-lg shadow-violet-200 scale-105' 
                            : 'bg-violet-50 text-violet-400 hover:bg-violet-100'
                        }`}
                    >
                        <Sparkles size={20} fill={activeType === 'ovulation' ? "currentColor" : "none"} />
                        <span>Ovulation</span>
                    </button>
                </div>
                <button
                    onClick={onDone}
                    className="w-full p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium bg-slate-800 text-white shadow-lg shadow-slate-200/50 transition-all duration-200 active:scale-95"
                >
                    <Check size={20} />
                    <span>Done Editing</span>
                </button>
            </div>
        </footer>
    );
}
