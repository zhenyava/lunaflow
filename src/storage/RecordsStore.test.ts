import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makePeriodRecord } from './DailyRecord';
import type { DailyRecord } from './DailyRecord';
import { STORAGE_CURRENT_VERSION } from '../constants';

vi.mock('./indexedDBStorage', () => ({
  openDB: vi.fn(async () => { }),
  read: vi.fn(async () => null),
  write: vi.fn(async () => { }),
  closeDB: vi.fn(async () => { }),
}));

const { providerMock } = vi.hoisted(() => ({
  providerMock: {
    isAuthenticated: vi.fn(() => false),
    fetchData: vi.fn(async () => null),
    uploadData: vi.fn(async () => { }),
    restoreSession: vi.fn(async () => null),
    signOut: vi.fn(async () => { }),
    handleCallback: vi.fn(),
    initialize: vi.fn(),
  }
}));

import { RecordsStore } from './RecordsStore';
import * as idb from './indexedDBStorage';

describe('migrateData', () => {
  const rs = new RecordsStore() as unknown as {
    migrateData(d: { ver: number; records: DailyRecord[] }): { records: DailyRecord[], wasMigrated: boolean }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns records from versioned storage without migration', () => {
    const mockRecords: DailyRecord[] = [makePeriodRecord('2024-01-01')];
    const { records, wasMigrated } = rs.migrateData({ ver: 2, records: mockRecords });
    expect(wasMigrated).toBe(false);
    expect(records).toEqual(mockRecords);
  });

  it('returns empty records without migration when ver >= current', () => {
    const { records, wasMigrated } = rs.migrateData({ ver: STORAGE_CURRENT_VERSION, records: [] });
    expect(records).toEqual([]);
    expect(wasMigrated).toBe(false);
  });
});

describe('RecordsStore', () => {
  let recordsStore: RecordsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    recordsStore = new RecordsStore();
    (recordsStore as unknown as { _cloudStorageProvider: unknown })._cloudStorageProvider = providerMock;
  });

  describe('events (derived view)', () => {
    it('returns empty array when data is null', () => {
      expect(recordsStore.events).toEqual([]);
    });

    it('filters out deleted records', async () => {
      const active = makePeriodRecord('2024-01-01');
      const deleted: DailyRecord = { date: '2024-01-02', updatedAt: Date.now(), isDeleted: true };
      await recordsStore.save([active, deleted]);
      expect(recordsStore.events).toEqual([active]);
    });
  });

  describe('allRecords', () => {
    it('returns all records including tombstones', () => {
      const active = makePeriodRecord('2024-01-01');
      const deleted: DailyRecord = { date: '2024-01-02', updatedAt: Date.now(), isDeleted: true };
      (recordsStore as { data: DailyRecord[] | null }).data = [active, deleted];
      expect(recordsStore.allRecords).toHaveLength(2);
    });
  });

  describe('loadLocal()', () => {
    it('reads from IndexedDB', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      vi.mocked(idb.read).mockResolvedValue(records);
      const result = await (recordsStore as { loadLocal(): Promise<DailyRecord[]> }).loadLocal();
      expect(idb.read).toHaveBeenCalledWith('lunaflow', 'appData', 'events');
      expect(result).toEqual(records);
    });
  });

  describe('saveLocal()', () => {
    it('writes to IndexedDB', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      await recordsStore.save(records);
      expect(idb.write).toHaveBeenCalledWith('lunaflow', 'appData', 'events', records);
    });
  });

  describe('merge()', () => {
    it('returns last-write-wins merged result', () => {
      const now = Date.now();
      const local = [makePeriodRecord('2024-01-01', now)];
      const remote = [makePeriodRecord('2024-01-01', now + 100)];
      const result = (recordsStore as { merge(l: DailyRecord[], r: DailyRecord[]): DailyRecord[] }).merge(local, remote);
      expect(result).toHaveLength(1);
      expect(result[0].updatedAt).toBe(now + 100);
    });

    it('prefers the record with the higher updatedAt across multiple dates', () => {
      const now = Date.now();
      const local: DailyRecord[] = [
        makePeriodRecord('2024-01-01', now),
        makePeriodRecord('2024-01-02', now + 200),
      ];
      const remote: DailyRecord[] = [
        { date: '2024-01-01', updatedAt: now + 100, isDeleted: true },
        makePeriodRecord('2024-01-02', now + 100),
      ];
      const result = (recordsStore as { merge(l: DailyRecord[], r: DailyRecord[]): DailyRecord[] }).merge(local, remote);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: '2024-01-01', updatedAt: now + 100, isDeleted: true });
      expect(result[1]).toEqual(makePeriodRecord('2024-01-02', now + 200));
    });
  });

  describe('upsertRecord()', () => {
    it('creates a new record when date does not exist', async () => {
      await recordsStore.save([makePeriodRecord('2024-01-01')]);
      recordsStore.upsertRecord('2024-01-05', { period: {} });

      await new Promise(resolve => setTimeout(resolve, 0));

      const saved = vi.mocked(idb.write).mock.calls.at(-1)![3] as DailyRecord[];
      expect(saved).toHaveLength(2);
      expect(saved[1].date).toBe('2024-01-05');
      expect(saved[1].period).toEqual({});
      expect(saved[1].isDeleted).toBe(false);
    });

    it('inserts new records in sorted order', async () => {
      await recordsStore.save([makePeriodRecord('2024-01-01'), makePeriodRecord('2024-01-10')]);
      recordsStore.upsertRecord('2024-01-05', { period: {} });

      const saved = vi.mocked(idb.write).mock.calls.at(-1)![3] as DailyRecord[];
      expect(saved.map(r => r.date)).toEqual(['2024-01-01', '2024-01-05', '2024-01-10']);
    });

    it('updates an existing record', async () => {
      await recordsStore.save([makePeriodRecord('2024-01-01')]);
      recordsStore.upsertRecord('2024-01-01', { ovulation: {} });

      const saved = vi.mocked(idb.write).mock.calls.at(-1)![3] as DailyRecord[];
      expect(saved).toHaveLength(1);
      expect(saved[0].period).toEqual({});
      expect(saved[0].ovulation).toEqual({});
    });

    it('marks record as deleted when all data removed', async () => {
      await recordsStore.save([makePeriodRecord('2024-01-01')]);
      recordsStore.upsertRecord('2024-01-01', { period: undefined });

      const saved = vi.mocked(idb.write).mock.calls.at(-1)![3] as DailyRecord[];
      expect(saved[0].isDeleted).toBe(true);
    });

    it('keeps record active when symptoms remain', async () => {
      const record: DailyRecord = { date: '2024-01-01', updatedAt: 1, period: {}, symptoms: { mood: ['happy'] } };
      await recordsStore.save([record]);
      recordsStore.upsertRecord('2024-01-01', { period: undefined });

      const saved = vi.mocked(idb.write).mock.calls.at(-1)![3] as DailyRecord[];
      expect(saved[0].isDeleted).toBe(false);
    });
  });

  describe('getRecord()', () => {
    it('returns record for existing non-deleted date', async () => {
      const record = makePeriodRecord('2024-01-01');
      await recordsStore.save([record]);
      expect(recordsStore.getRecord('2024-01-01')).toEqual(record);
    });

    it('returns undefined for deleted record', async () => {
      const deleted: DailyRecord = { date: '2024-01-01', updatedAt: 1, isDeleted: true };
      await recordsStore.save([deleted]);
      expect(recordsStore.getRecord('2024-01-01')).toBeUndefined();
    });

    it('returns undefined for non-existent date', async () => {
      await recordsStore.save([makePeriodRecord('2024-01-01')]);
      expect(recordsStore.getRecord('2024-06-15')).toBeUndefined();
    });

    it('returns undefined when data is null', () => {
      expect(recordsStore.getRecord('2024-01-01')).toBeUndefined();
    });
  });

  describe('fetchFromCloud()', () => {
    const fetchFromCloud = (store: RecordsStore) =>
      (store as unknown as { fetchFromCloud(provider: typeof providerMock, id: string): Promise<DailyRecord[]> })
        .fetchFromCloud(providerMock, 'file-id');

    it('fetches from provider and migrates data', async () => {
      const record = makePeriodRecord('2024-01-01');
      const rawData = { ver: STORAGE_CURRENT_VERSION, records: [record] };
      vi.mocked(providerMock.fetchData).mockResolvedValue(rawData);

      const result = await fetchFromCloud(recordsStore);
      expect(result).toEqual([record]);
    });

    it('returns empty array for null cloud data', async () => {
      vi.mocked(providerMock.fetchData).mockResolvedValue(null);
      const result = await fetchFromCloud(recordsStore);
      expect(result).toEqual([]);
    });

    it('returns empty array for invalid cloud data', async () => {
      vi.mocked(providerMock.fetchData).mockResolvedValue({ foo: 'bar' });
      const result = await fetchFromCloud(recordsStore);
      expect(result).toEqual([]);
    });
  });

});
