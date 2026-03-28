import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { EventType, DailyRecord } from '../types';
import type { RecordsStore } from '../store/RecordsStore';

export function useCalendarEvents(store: RecordsStore) {
  const [activeType, setActiveType] = useState<EventType>('period');

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = Date.now();
    const prev = store.allRecords ?? [];
    const existingIdx = prev.findIndex(e => e.date === dateStr);
    const existing = existingIdx >= 0 ? prev[existingIdx] : null;

    let newRecords;

    if (existing) {
      const newRecord = { ...existing, updatedAt: now };

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
      const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

      newRecord.isDeleted = !hasPeriod && !hasOvulation && !hasSymptoms;

      newRecords = [...prev];
      newRecords[existingIdx] = newRecord;
    } else {
      const newRecord = {
        date: dateStr,
        updatedAt: now,
        isDeleted: false,
        ...(activeType === 'period' ? { period: {} } : { ovulation: {} }),
      };
      newRecords = [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
    }

    store.save(newRecords);
  }, [activeType, store]);

  const updateRecord = useCallback((dateStr: string, updates: Partial<DailyRecord>) => {
    const prev = store.allRecords ?? [];
    const existingIdx = prev.findIndex(e => e.date === dateStr);
    const now = Date.now();

    let newRecords;

    if (existingIdx >= 0) {
      const newRecord = { ...prev[existingIdx], ...updates, updatedAt: now };

      const hasPeriod = !!newRecord.period;
      const hasOvulation = !!newRecord.ovulation;
      const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

      newRecord.isDeleted = !hasPeriod && !hasOvulation && !hasSymptoms;

      newRecords = [...prev];
      newRecords[existingIdx] = newRecord;
    } else {
      const newRecord = {
        date: dateStr,
        updatedAt: now,
        isDeleted: false,
        ...updates,
      };
      const hasPeriod = !!newRecord.period;
      const hasOvulation = !!newRecord.ovulation;
      const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

      if (!hasPeriod && !hasOvulation && !hasSymptoms) {
        newRecord.isDeleted = true;
      }

      newRecords = [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
    }

    store.save(newRecords);
  }, [store]);

  return {
    events: store.events,
    activeType,
    setActiveType,
    handleDayClick,
    updateRecord,
  };
}
