import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { EventType, DailyRecord } from '../storage/DailyRecord';
import type { RecordsStore } from '../storage/RecordsStore';

export function useCalendarEvents(store: RecordsStore) {
  const [activeType, setActiveType] = useState<EventType>('period');

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = store.getRecord(dateStr);

    if (existing) {
      const updates: Partial<DailyRecord> =
        activeType === 'period'
          ? { period: existing.period ? undefined : {} }
          : { ovulation: existing.ovulation ? undefined : {} };
      store.upsertRecord(dateStr, updates);
    } else {
      store.upsertRecord(dateStr, activeType === 'period' ? { period: {} } : { ovulation: {} });
    }
  }, [activeType, store]);

  const updateRecord = useCallback((dateStr: string, updates: Partial<DailyRecord>) => {
    store.upsertRecord(dateStr, updates);
  }, [store]);

  return {
    events: store.events,
    activeType,
    setActiveType,
    handleDayClick,
    updateRecord,
  };
}
