import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import type { DailyRecord, EventType } from '../types';
import { getLocalEvents, saveLocalEvents } from '../services/storageService';

export function useCalendarEvents() {
  // Internal state holds ALL records, including those marked as isDeleted (tombstones)
  const [records, setRecords] = useState<DailyRecord[]>(() => getLocalEvents());
  const [activeType, setActiveType] = useState<EventType>('period');

  // Save to Local Storage immediately when records change
  useEffect(() => {
    saveLocalEvents(records);
  }, [records]);

  // Derived state: only records that are NOT deleted. 
  // This is what the UI and business logic (stats) will use.
  const activeEvents = useMemo(() => {
    return records.filter(r => !r.isDeleted);
  }, [records]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = Date.now();

    setRecords(prev => {
      const existingIdx = prev.findIndex(e => e.date === dateStr);
      const existing = existingIdx >= 0 ? prev[existingIdx] : null;

      if (existing) {
        const newRecord: DailyRecord = { ...existing, updatedAt: now };

        if (activeType === 'period') {
            if (newRecord.period) {
                delete newRecord.period;
            } else {
                newRecord.period = {};
            }
        } else if (activeType === 'ovulation') {
            if (newRecord.ovulation) {
                delete newRecord.ovulation;
            } else {
                newRecord.ovulation = {};
            }
        }

        const hasPeriod = !!newRecord.period;
        const hasOvulation = !!newRecord.ovulation;
        
        // If no data left for this day, mark as deleted
        if (!hasPeriod && !hasOvulation) {
            newRecord.isDeleted = true;
        } else {
            newRecord.isDeleted = false;
        }

        const newRecords = [...prev];
        newRecords[existingIdx] = newRecord;
        return newRecords;
      } else {
        const newRecord: DailyRecord = {
          date: dateStr,
          updatedAt: now,
          isDeleted: false,
        };

        if (activeType === 'period') {
          newRecord.period = {};
        } else if (activeType === 'ovulation') {
          newRecord.ovulation = {};
        }

        return [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
      }
    });
  }, [activeType]);

  return {
    events: activeEvents,    // Clean events for UI
    allRecords: records,     // Raw records for Sync
    setEvents: setRecords,   // Updater for Sync
    activeType,
    setActiveType,
    handleDayClick
  };
}
