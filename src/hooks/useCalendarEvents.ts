import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent, EventType } from '../types';
import { getLocalEvents, saveLocalEvents } from '../services/storageService';

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => getLocalEvents());
  const [activeType, setActiveType] = useState<EventType>('period');

  // Save to Local Storage immediately when events change
  useEffect(() => {
    saveLocalEvents(events);
  }, [events]);

  const handleDayClick = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setEvents(prev => {
      const existingIndex = prev.findIndex(e => e.date === dateStr);
      const newEvents = [...prev];
      if (existingIndex >= 0) {
        const existing = newEvents[existingIndex];
        if (existing.type === activeType) {
            newEvents.splice(existingIndex, 1);
        } else {
            newEvents[existingIndex] = { ...existing, type: activeType };
        }
      } else {
        newEvents.push({ date: dateStr, type: activeType });
      }
      return newEvents;
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
