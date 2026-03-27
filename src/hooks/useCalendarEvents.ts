import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import type { DailyRecord, EventType } from '../types';
import { getStoredEvents, saveStoredEvents } from '../services/storageService';

export function useCalendarEvents() {
  // Internal state holds ALL records, including those marked as isDeleted (tombstones).
  // null means "not yet loaded from IndexedDB" — distinct from an empty array (no events).
  const [records, setRecords] = useState<DailyRecord[] | null>(null);
  const [activeType, setActiveType] = useState<EventType>('period');

  // Load from IndexedDB on mount
  useEffect(() => {
    getStoredEvents().then(setRecords);
  }, []);

  // Save to IndexedDB when records change. null guard prevents saving before the
  // initial load completes — avoids overwriting IndexedDB with empty state on mount.
  useEffect(() => {
    if (records === null) return;
    saveStoredEvents(records);
  }, [records]);

  // Derived state: only records that are NOT deleted.
  // This is what the UI and business logic (stats) will use.
  const activeEvents = useMemo(() => {
    return (records ?? []).filter(r => !r.isDeleted);
  }, [records]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = Date.now();

    setRecords(prev => {
      const existingIdx = prev!.findIndex(e => e.date === dateStr);
      const existing = existingIdx >= 0 ? prev![existingIdx] : null;

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
        const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

        // If no data left for this day, mark as deleted
        if (!hasPeriod && !hasOvulation && !hasSymptoms) {
            newRecord.isDeleted = true;
        } else {
            newRecord.isDeleted = false;
        }

        const newRecords = [...prev!];
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

        return [...prev!, newRecord].sort((a, b) => a.date.localeCompare(b.date));
      }
    });
  }, [activeType]);

  const updateRecord = useCallback((dateStr: string, updates: Partial<DailyRecord>) => {
    setRecords(prev => {
      const existingIdx = prev!.findIndex(e => e.date === dateStr);
      const now = Date.now();

      if (existingIdx >= 0) {
        const newRecord = { ...prev![existingIdx], ...updates, updatedAt: now };

        // Check if there's any data left
        const hasPeriod = !!newRecord.period;
        const hasOvulation = !!newRecord.ovulation;
        const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

        if (!hasPeriod && !hasOvulation && !hasSymptoms) {
            newRecord.isDeleted = true;
        } else {
            newRecord.isDeleted = false;
        }

        const newRecords = [...prev!];
        newRecords[existingIdx] = newRecord;
        return newRecords;
      } else {
        // Create new record
        const newRecord: DailyRecord = {
          date: dateStr,
          updatedAt: now,
          isDeleted: false,
          ...updates
        };

        const hasPeriod = !!newRecord.period;
        const hasOvulation = !!newRecord.ovulation;
        const hasSymptoms = !!newRecord.symptoms && Object.keys(newRecord.symptoms).length > 0;

        if (!hasPeriod && !hasOvulation && !hasSymptoms) {
            newRecord.isDeleted = true;
        }

        return [...prev!, newRecord].sort((a, b) => a.date.localeCompare(b.date));
      }
    });
  }, []);

  return {
    events: activeEvents,          // Clean events for UI
    allRecords: records ?? [],     // Raw records for Sync
    setEvents: setRecords as React.Dispatch<React.SetStateAction<DailyRecord[]>>,
    activeType,
    setActiveType,
    handleDayClick,
    updateRecord
  };
}
