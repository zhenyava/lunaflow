import { format } from 'date-fns';
import { X, Droplet, Sparkles, Trash2 } from 'lucide-react';
import type { DailyRecord, FlowIntensity } from '../types';
import symptomsData from '../data/symptoms.json';

interface DayDetailsPanelProps {
  date: Date;
  record?: DailyRecord;
  onClose: () => void;
  onUpdate: (dateStr: string, updates: Partial<DailyRecord>) => void;
}

const INTENSITY_OPTIONS: { value: FlowIntensity; label: string; color: string }[] = [
  { value: 'spotting', label: 'Spotting', color: 'bg-rose-100 text-rose-700' },
  { value: 'light', label: 'Light', color: 'bg-rose-300 text-white' },
  { value: 'medium', label: 'Medium', color: 'bg-rose-500 text-white' },
  { value: 'heavy', label: 'Heavy', color: 'bg-rose-700 text-white' },
];

export default function DayDetailsPanel({ date, record, onClose, onUpdate }: DayDetailsPanelProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const isPeriod = !!record?.period;
  const isOvulation = !!record?.ovulation;
  const currentIntensity = record?.period?.intensity || 'medium';
  const currentSymptoms = record?.symptoms || {};

  const handleTogglePeriod = () => {
    if (isPeriod) {
      onUpdate(dateStr, { period: undefined });
    } else {
      onUpdate(dateStr, { period: { intensity: 'medium' }, ovulation: undefined });
    }
  };

  const handleToggleOvulation = () => {
    if (isOvulation) {
      onUpdate(dateStr, { ovulation: undefined });
    } else {
      onUpdate(dateStr, { ovulation: {}, period: undefined });
    }
  };

  const handleIntensityChange = (intensity: FlowIntensity) => {
    onUpdate(dateStr, { period: { ...record?.period, intensity } });
  };

  const handleToggleSymptom = (categoryId: string, optionId: string) => {
    const updatedSymptoms = { ...currentSymptoms };
    const categorySymptoms = [...(updatedSymptoms[categoryId] || [])];
    
    if (categorySymptoms.includes(optionId)) {
      updatedSymptoms[categoryId] = categorySymptoms.filter(id => id !== optionId);
      if (updatedSymptoms[categoryId].length === 0) {
        delete updatedSymptoms[categoryId];
      }
    } else {
      updatedSymptoms[categoryId] = [...categorySymptoms, optionId];
    }

    onUpdate(dateStr, { symptoms: updatedSymptoms });
  };

  const handleClearSymptoms = () => {
    onUpdate(dateStr, { symptoms: undefined });
  };

  const hasAnySymptoms = Object.keys(currentSymptoms).some(
    (key) => currentSymptoms[key].length > 0
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:relative md:rounded-none md:shadow-none md:border-l md:border-slate-200 md:w-80 md:h-full flex flex-col max-h-[85vh] md:max-h-none">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800">
          {format(date, 'MMMM d, yyyy')}
        </h2>
        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {/* Cycle Stage Toggles */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cycle Stage</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleTogglePeriod}
              className={`flex flex-row items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                isPeriod 
                  ? 'border-rose-500 bg-rose-50 text-rose-700' 
                  : 'border-slate-100 bg-white text-slate-500 hover:border-rose-200'
              }`}
            >
              <Droplet className={`w-5 h-5 ${isPeriod ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="text-sm font-medium">Period</span>
            </button>
            
            <button
              onClick={handleToggleOvulation}
              className={`flex flex-row items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                isOvulation 
                  ? 'border-violet-500 bg-violet-50 text-violet-700' 
                  : 'border-slate-100 bg-white text-slate-500 hover:border-violet-200'
              }`}
            >
              <Sparkles className={`w-5 h-5 ${isOvulation ? 'fill-violet-500 text-violet-500' : ''}`} />
              <span className="text-sm font-medium">Ovulation</span>
            </button>
          </div>
        </div>

        {/* Period Intensity */}
        {isPeriod && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flow Intensity</h3>
            <div className="grid grid-cols-4 gap-2">
              {INTENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleIntensityChange(option.value)}
                  className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                    currentIntensity === option.value
                      ? `border-rose-500 ${option.color}`
                      : 'border-slate-100 bg-white text-slate-600 hover:border-rose-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mb-1 ${
                    currentIntensity === option.value ? 'bg-current' : option.color.split(' ')[0]
                  }`} />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Symptoms Sections */}
        {symptomsData.categories.map((category) => (
          <div key={category.id} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{category.name}</h3>
            <div className="flex flex-wrap gap-2">
              {category.options.map((option) => {
                const isSelected = currentSymptoms[category.id]?.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => handleToggleSymptom(category.id, option.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      isSelected
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {hasAnySymptoms && (
          <button
            onClick={handleClearSymptoms}
            className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-slate-400 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear all symptoms
          </button>
        )}
      </div>
    </div>
  );
}
