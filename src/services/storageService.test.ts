import { describe, it, expect } from 'vitest';
import { mergeEvents } from './storageService';
import type { CalendarEvent } from '../types';

describe('storageService - mergeEvents', () => {
  const createEvent = (date: string, type: 'period' | 'ovulation' = 'period'): CalendarEvent => ({
    date,
    type
  });

  it('should return empty array when merging empty arrays', () => {
    expect(mergeEvents([], [])).toEqual([]);
  });

  it('should return local events when remote is empty', () => {
    const local = [createEvent('2024-01-01')];
    expect(mergeEvents(local, [])).toEqual(local);
  });

  it('should return remote events when local is empty', () => {
    const remote = [createEvent('2024-01-01')];
    expect(mergeEvents([], remote)).toEqual(remote);
  });

  it('should merge completely different events', () => {
    const local = [createEvent('2024-01-01')];
    const remote = [createEvent('2024-01-05')];
    const expected = [createEvent('2024-01-01'), createEvent('2024-01-05')];
    expect(mergeEvents(local, remote)).toEqual(expected);
  });

  it('should deduplicate exact same events', () => {
    const local = [createEvent('2024-01-01')];
    const remote = [createEvent('2024-01-01')];
    expect(mergeEvents(local, remote)).toEqual([createEvent('2024-01-01')]);
  });

  it('should keep events with same date but different types', () => {
    const local = [createEvent('2024-01-01', 'period')];
    const remote = [createEvent('2024-01-01', 'ovulation')];

    const merged = mergeEvents(local, remote);

    expect(merged.length).toBe(2);
    expect(merged).toContainEqual(createEvent('2024-01-01', 'period'));
    expect(merged).toContainEqual(createEvent('2024-01-01', 'ovulation'));
  });

  it('should overwrite remote with local when keys match (object reference check)', () => {
    // This is important because local changes should take precedence over remote during sync.
    const remoteEvent = createEvent('2024-01-01');
    const localEvent = createEvent('2024-01-01');

    // Create new objects with an extra property to test reference/overwrite
    const remoteWithExtra = { ...remoteEvent, source: 'remote' } as unknown as CalendarEvent;
    const localWithExtra = { ...localEvent, source: 'local' } as unknown as CalendarEvent;

    const merged = mergeEvents([localWithExtra], [remoteWithExtra]);

    expect(merged.length).toBe(1);
    expect((merged[0] as unknown as { source: string }).source).toBe('local');
  });

  it('should sort the resulting array chronologically', () => {
    const local = [createEvent('2024-01-10'), createEvent('2024-01-05')];
    const remote = [createEvent('2024-01-15'), createEvent('2024-01-01')];

    const merged = mergeEvents(local, remote);

    expect(merged).toEqual([
      createEvent('2024-01-01'),
      createEvent('2024-01-05'),
      createEvent('2024-01-10'),
      createEvent('2024-01-15')
    ]);
  });
});
