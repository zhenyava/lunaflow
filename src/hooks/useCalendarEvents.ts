import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { DailyRecord, EventType } from '../types';
import { getLocalEvents, saveLocalEvents } from '../services/storageService';

export function useCalendarEvents() {
  const [events, setEvents] = useState<DailyRecord[]>(() => getLocalEvents());
  const [activeType, setActiveType] = useState<EventType>('period');

  // Save to Local Storage immediately when events change
  useEffect(() => {
    saveLocalEvents(events);
  }, [events]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = Date.now();

    setEvents(prev => {
      const existingIdx = prev.findIndex(e => e.date === dateStr);
      const existing = existingIdx >= 0 ? prev[existingIdx] : null;

      if (existing) {
        const newRecord: DailyRecord = { ...existing, updatedAt: now };

        if (activeType === 'period') {
            if (newRecord.period?.isFlowing) {
                newRecord.period = { ...newRecord.period, isFlowing: false };
            } else {
                newRecord.period = { ...newRecord.period, isFlowing: true };
            }
        } else if (activeType === 'ovulation') {
            if (newRecord.ovulation?.isConfirmed) {
                newRecord.ovulation = { ...newRecord.ovulation, isConfirmed: false };
            } else {
                newRecord.ovulation = { ...newRecord.ovulation, isConfirmed: true };
            }
        }

        const hasPeriod = newRecord.period?.isFlowing;
        const hasOvulation = newRecord.ovulation?.isConfirmed;
        
        if (!hasPeriod && !hasOvulation) {
            newRecord.isDeleted = true;
        } else {
            newRecord.isDeleted = false;
        }

        const newEvents = [...prev];
        newEvents[existingIdx] = newRecord;
        return newEvents;
      } else {
        const newRecord: DailyRecord = {
          date: dateStr,
          updatedAt: now,
          isDeleted: false,
        };

        if (activeType === 'period') {
          newRecord.period = { isFlowing: true };
        } else if (activeType === 'ovulation') {
          newRecord.ovulation = { isConfirmed: true };
        }

        return [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
      }
    });
  }, [activeType]);

  return {
    events,
    setEvents,
    activeType,
    setActiveType,
    handleDayClick
  };
}
