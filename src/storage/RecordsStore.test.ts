import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordsStore } from './RecordsStore';
import type { DailyRecord } from './DailyRecord';
import type { LocalStorageProvider } from './LocalStorageProvider';


const makePeriodRecord = (date: string): DailyRecord => ({
  date,
  period: {},
  updatedAt: Date.now()
});

describe('RecordsStore', () => {
  let recordsStore: RecordsStore;
  let mockLocal: LocalStorageProvider;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => { });

    mockLocal = {
      read: vi.fn(async () => ({ ver: 1, records: [] })),
      write: vi.fn(async () => { }),
    };

    recordsStore = new RecordsStore(mockLocal);
    await recordsStore.init();
  });

  describe('Domain Logic', () => {
    it('filters out deleted records from events view', async () => {
      const active = makePeriodRecord('2024-01-01');
      const deleted: DailyRecord = { date: '2024-01-02', updatedAt: Date.now(), isDeleted: true };

      // Manually trigger the syncDerivedState via store's internal data (using private access for test)
      (recordsStore as unknown as { _store: { setData(d: unknown): void } })._store.setData({ ver: 1, records: [active, deleted] });

      expect(recordsStore.events).toEqual([active]);
    });

    it('clears state when store data becomes null', async () => {
      const date = '2024-03-01';
      await recordsStore.upsertRecord(date, { period: {} });
      expect(recordsStore.events).toHaveLength(1);
      expect(recordsStore.allRecords).toHaveLength(1);

      // Directly manipulating store to trigger listener with null data
      (recordsStore as unknown as { _store: { setData(d: unknown): void } })._store.setData(null);

      expect(recordsStore.events).toHaveLength(0);
      expect(recordsStore.allRecords).toBeNull();
    });
  });

  describe('upsertRecord', () => {
    it('updates events and dateIndex after upsert', async () => {
      const date = '2024-03-01';
      await recordsStore.upsertRecord(date, { period: {} });

      expect(recordsStore.events).toHaveLength(1);
      const record = await recordsStore.getRecord(date);
      expect(record).toBeDefined();
      expect(record!.date).toBe(date);
    });

    it('merges updates and preserves existing properties', async () => {
      const date = '2024-03-01';
      await recordsStore.upsertRecord(date, { period: { intensity: 'medium' } });
      await recordsStore.upsertRecord(date, { ovulation: {} });

      const record = await recordsStore.getRecord(date);
      expect(record?.period).toEqual({ intensity: 'medium' });
      expect(record?.ovulation).toEqual({});
    });

    it('refreshes updatedAt timestamp on every call', async () => {
      const date = '2024-03-01';

      vi.setSystemTime(1000);
      await recordsStore.upsertRecord(date, { period: {} });
      let allRecords = recordsStore.allRecords;
      expect(allRecords![0].updatedAt).toBe(1000);

      vi.setSystemTime(2000);
      await recordsStore.upsertRecord(date, { ovulation: {} });
      allRecords = recordsStore.allRecords;
      expect(allRecords![0].updatedAt).toBe(2000);
    });

    it('persists changes to local storage with expected StorageEnvelope', async () => {
      const date = '2024-03-01';
      await recordsStore.upsertRecord(date, { period: { intensity: 'heavy' } });

      expect(mockLocal.write).toHaveBeenCalledWith(expect.objectContaining({
        ver: expect.any(Number),
        records: expect.arrayContaining([
          expect.objectContaining({
            date,
            period: { intensity: 'heavy' },
            updatedAt: expect.any(Number)
          })
        ])
      }));
    });

    it('maintains sorted order after upsert', async () => {
      await recordsStore.upsertRecord('2024-05-10', { period: {} });
      await recordsStore.upsertRecord('2024-05-01', { period: {} });

      expect(recordsStore.allRecords![0].date).toBe('2024-05-01');
      expect(recordsStore.allRecords![1].date).toBe('2024-05-10');
    });
  });

  describe('cloudState', () => {
    it('proxies cloudState from internal store', () => {
      expect(recordsStore.cloudState).toBe('unsynced');
    });
  });

  describe('subscribeDataChanged', () => {
    it('proxies subscription listeners', () => {
      const listener = vi.fn();
      recordsStore.subscribeDataChanged(listener);
      // Directly manipulating store to trigger listener
      (recordsStore as unknown as { _store: { setData(d: unknown): void } })._store.setData({ ver: 1, records: [] });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('clears all state after destroy', async () => {
      await recordsStore.upsertRecord('2024-03-01', { period: {} });
      expect(recordsStore.events).toHaveLength(1);

      recordsStore.destroy();

      expect(recordsStore.events).toHaveLength(0);
      expect(recordsStore.allRecords).toBeNull();
    });

    it('upsertRecord throws after destroy', async () => {
      recordsStore.destroy();
      await expect(recordsStore.upsertRecord('2024-01-01', {})).rejects.toThrow('Method called before initialization');
    });
  });

  describe('Lifecycle Guards', () => {
    it('throws if upsertRecord is called before init', async () => {
      const freshStore = new RecordsStore(mockLocal);
      await expect(freshStore.upsertRecord('2024-01-01', {})).rejects.toThrow('Method called before initialization');
    });

    it('awaits pending init in upsertRecord', async () => {
      const freshStore = new RecordsStore(mockLocal);
      const initPromise = freshStore.init();
      const upsertPromise = freshStore.upsertRecord('2024-01-01', { period: {} });

      await initPromise;
      await upsertPromise;

      const record = await freshStore.getRecord('2024-01-01');
      expect(record).toBeDefined();
    });
  });
});
