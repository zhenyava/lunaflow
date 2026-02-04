import { Droplet, Sparkles } from 'lucide-react';
import type { EventType } from '../types';

interface MobileControlsProps {
    activeType: EventType;
    setActiveType: (type: EventType) => void;
}

export default function MobileControls({ activeType, setActiveType }: MobileControlsProps) {
    return (
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
    );
}
