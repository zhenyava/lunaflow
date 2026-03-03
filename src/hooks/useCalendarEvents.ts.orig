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
      const existing = prev.find(e => e.date === dateStr);

      if (existing) {
        if (existing.type === activeType) {
            // Remove the event if it already has the active type
            return prev.filter(e => e.date !== dateStr);
        } else {
            // Update the event type
            return prev.map(e => e.date === dateStr ? { ...e, type: activeType } : e);
        }
      } else {
        // Add new event
        return [...prev, { date: dateStr, type: activeType }];
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
