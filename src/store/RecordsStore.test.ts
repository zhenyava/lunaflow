import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makePeriodRecord } from '../types';
import type { DailyRecord } from '../types';
import { STORAGE_CURRENT_VERSION } from '../constants';

vi.mock('./indexedDBStorage', () => ({
  readDailyRecords: vi.fn(async () => null),
  writeDailyRecords: vi.fn(async () => { }),
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

vi.mock('../storageProviders/StorageProviderRegistry', () => ({
  storageProviderRegistry: {
    getActiveProvider: vi.fn(() => providerMock),
    notify: vi.fn(),
    subscribe: vi.fn(() => () => { }),
  },
}));

import { recordsStore } from './RecordsStore';
import * as idb from './indexedDBStorage';

describe('migrateData', () => {
  const rs = recordsStore as unknown as {
    migrateData(d: unknown): { records: DailyRecord[], wasMigrated: boolean }
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

  it('returns empty records for null input', () => {
    const { records, wasMigrated } = rs.migrateData(null);
    expect(records).toEqual([]);
    expect(wasMigrated).toBe(false);
  });

  it('returns empty records for invalid format', () => {
    const { records, wasMigrated } = rs.migrateData({ foo: 'bar' });
    expect(records).toEqual([]);
    expect(wasMigrated).toBe(false);
  });
});

describe('RecordsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (recordsStore as unknown as { data: DailyRecord[] | null }).data = null;
    (recordsStore as unknown as { _remoteStorageProvider: unknown })._remoteStorageProvider = providerMock;
  });

  describe('events (derived view)', () => {
    it('returns empty array when data is null', () => {
      expect(recordsStore.events).toEqual([]);
    });

    it('filters out deleted records', () => {
      const active = makePeriodRecord('2024-01-01');
      const deleted: DailyRecord = { date: '2024-01-02', updatedAt: Date.now(), isDeleted: true };
      (recordsStore as { data: DailyRecord[] | null }).data = [active, deleted];
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

  describe('isLoaded', () => {
    it('returns false when data is null', () => {
      expect(recordsStore.isLoaded).toBe(false);
    });

    it('returns true after save', async () => {
      await recordsStore.save([]);
      expect(recordsStore.isLoaded).toBe(true);
    });
  });

  describe('loadLocal()', () => {
    it('reads from IndexedDB', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      vi.mocked(idb.readDailyRecords).mockResolvedValue(records);
      const result = await (recordsStore as { loadLocal(): Promise<DailyRecord[]> }).loadLocal();
      expect(idb.readDailyRecords).toHaveBeenCalled();
      expect(result).toEqual(records);
    });
  });

  describe('saveLocal()', () => {
    it('writes to IndexedDB', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      await recordsStore.save(records);
      expect(idb.writeDailyRecords).toHaveBeenCalledWith(records);
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

  describe('fetchFromCloud()', () => {
    it('fetches from provider and migrates data', async () => {
      const record = makePeriodRecord('2024-01-01');
      const rawData = { ver: STORAGE_CURRENT_VERSION, records: [record] };
      vi.mocked(providerMock.fetchData).mockResolvedValue(rawData);
      
      const result = await (recordsStore as unknown as { fetchFromCloud(id: string): Promise<DailyRecord[]> }).fetchFromCloud('file-id');
      expect(result).toEqual([record]);
    });
  });

  describe('prepareDataToCloud()', () => {
    it('wraps data in versioned envelope before uploading', () => {
      const records = [makePeriodRecord('2024-01-01')];
      const result = (recordsStore as unknown as { prepareDataToCloud(d: DailyRecord[]): any }).prepareDataToCloud(records);
      expect(result).toEqual({ ver: STORAGE_CURRENT_VERSION, records });
    });
  });
});
