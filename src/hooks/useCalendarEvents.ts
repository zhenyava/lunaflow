import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { EventType, DailyRecord } from '../storage/DailyRecord';
import type { RecordsStore } from '../storage/RecordsStore';

export function useCalendarEvents(store: RecordsStore) {
  const [activeType, setActiveType] = useState<EventType>('period');

  const handleDayClick = useCallback(async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = await store.getRecord(dateStr);

    if (existing) {
      const updates: Partial<DailyRecord> =
        activeType === 'period'
          ? { period: existing.period ? undefined : {} }
          : { ovulation: existing.ovulation ? undefined : {} };
      await store.upsertRecord(dateStr, updates);
    } else {
      await store.upsertRecord(dateStr, activeType === 'period' ? { period: {} } : { ovulation: {} });
    }
  }, [activeType, store]);

  const updateRecord = useCallback(async (dateStr: string, updates: Partial<DailyRecord>) => {
    await store.upsertRecord(dateStr, updates);
  }, [store]);

  return {
    events: store.events,
    activeType,
    setActiveType,
    handleDayClick,
    updateRecord,
  };
}
