import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataStore } from './DataStore';
import type { DailyRecord } from '../types';
import { makePeriodRecord } from '../types';
import type { CloudStorageProvider } from '../cloudStorageProviders/CloudStorageProviderInterface';

// Minimal concrete subclass for testing DataStore behavior
class TestStore extends DataStore<DailyRecord[]> {
  loadLocalMock = vi.fn(async (): Promise<DailyRecord[] | null> => null);
  saveLocalMock = vi.fn(async (): Promise<void> => {});
  mergeMock = vi.fn((local: DailyRecord[], cloud: DailyRecord[]) => [...local, ...cloud]);
  fetchFromCloudMock = vi.fn(async (): Promise<DailyRecord[]> => []);
  prepareDataToCloudMock = vi.fn((data: DailyRecord[]) => ({ ver: 1, records: data }));

  get fileId() { return 'test-file-id'; }

  protected loadLocal() { return this.loadLocalMock(); }
  protected saveLocal(data: DailyRecord[]) { return this.saveLocalMock(data); }
  protected merge(local: DailyRecord[], cloud: DailyRecord[]) { return this.mergeMock(local, cloud); }
  protected fetchFromCloud(fileId: string) { return this.fetchFromCloudMock(fileId); }
  protected prepareDataToCloud(data: DailyRecord[]) { return this.prepareDataToCloudMock(data); }

  // Expose internals for testing
  get testData() { return this.data; }
  set testData(val: DailyRecord[] | null) { this.data = val; }
}

describe('DataStore', () => {
  let store: TestStore;
  let providerMock: {
    id: string;
    name: string;
    ensureFileExists: ReturnType<typeof vi.fn>;
    fetchData: ReturnType<typeof vi.fn>;
    uploadData: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = new TestStore();
    providerMock = {
      id: 'test-provider',
      name: 'Test Provider',
      ensureFileExists: vi.fn(async () => true),
      fetchData: vi.fn(async () => []),
      uploadData: vi.fn(async () => {}),
      signOut: vi.fn(async () => {}),
    };
    store.init();
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('save()', () => {
    it('sets data and calls saveLocal', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      await store.save(records);
      expect(store.testData).toEqual(records);
      expect(store.saveLocalMock).toHaveBeenCalledWith(records);
    });

    it('notifies data subscribers', async () => {
      const listener = vi.fn();
      store.subscribeDataChanged(listener);
      await store.save([]);
      expect(listener).toHaveBeenCalled();
    });

    it('sets cloudState to unsynced if not uploading', async () => {
      await store.save([]);
      expect(store.cloudState).toBe('unsynced');
    });

    it('schedules debounced upload when provider is connected', async () => {
      await store.connectCloud(providerMock as unknown as CloudStorageProvider);

      const records = [makePeriodRecord('2024-01-01')];
      await store.save(records);

      expect(providerMock.uploadData).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2000);
      expect(providerMock.uploadData).toHaveBeenCalledWith('test-file-id', expect.any(Object));
    });

    it('does not upload if no provider is connected', async () => {
      await store.save([]);
      await vi.advanceTimersByTimeAsync(2000);
      expect(providerMock.uploadData).not.toHaveBeenCalled();
    });

    it('cancels previous debounce timer when save is called again', async () => {
      await store.connectCloud(providerMock as unknown as CloudStorageProvider);

      const first = [makePeriodRecord('2024-01-01')];
      const second = [makePeriodRecord('2024-01-02')];

      await store.save(first);
      await vi.advanceTimersByTimeAsync(1000);
      await store.save(second); // resets timer

      await vi.advanceTimersByTimeAsync(2000);
      expect(providerMock.uploadData).toHaveBeenCalledOnce();
      expect(providerMock.uploadData).toHaveBeenCalledWith('test-file-id', { ver: 1, records: second });
    });
  });

  describe('forceSync()', () => {
    beforeEach(async () => {
      await store.connectCloud(providerMock as unknown as CloudStorageProvider);
      providerMock.uploadData.mockClear(); // connectCloud calls forceSync, which might call upload
    });

    it('does nothing if not connected', async () => {
      store.disconnectCloud();
      store.fetchFromCloudMock.mockClear();
      await store.forceSync();
      expect(store.fetchFromCloudMock).not.toHaveBeenCalled();
    });

    it('fetches cloud, merges, and updates local if different', async () => {
      const local = [makePeriodRecord('2024-01-01')];
      const cloud = [makePeriodRecord('2024-01-02')];
      const merged = [...local, ...cloud];

      store.mergeMock.mockReturnValue(merged);
      store.fetchFromCloudMock.mockResolvedValue(cloud);
      store.testData = local;

      await store.forceSync();

      expect(store.saveLocalMock).toHaveBeenCalledWith(merged);
      expect(store.testData).toEqual(merged);
    });

    it('uploads to cloud if merged differs from cloud', async () => {
      const local = [makePeriodRecord('2024-01-01')];
      const cloud: DailyRecord[] = [];
      const merged = [...local];

      store.mergeMock.mockReturnValue(merged);
      store.fetchFromCloudMock.mockResolvedValue(cloud);
      store.testData = local;

      await store.forceSync();

      await vi.advanceTimersByTimeAsync(2000);
      expect(providerMock.uploadData).toHaveBeenCalled();
    });

    it('sets cloudState to synced after successful upload', async () => {
      store.fetchFromCloudMock.mockResolvedValue([]);
      store.mergeMock.mockReturnValue([]);
      store.testData = [makePeriodRecord('2024-01-01')];

      await store.forceSync(); // this will schedule upload
      await vi.advanceTimersByTimeAsync(2000);
      // Wait for the async callback inside setTimeout to finish
      await vi.runAllTicks();

      expect(store.cloudState).toBe('synced');
    });

    it('resets cloudState to unsynced on error', async () => {
      store.fetchFromCloudMock.mockRejectedValue(new Error('Network error'));
      await store.forceSync();
      expect(store.cloudState).toBe('unsynced');
    });
  });

  describe('subscriber pattern', () => {
    it('subscribeDataChanged fires on save', async () => {
      const fn = vi.fn();
      store.subscribeDataChanged(fn);
      await store.save([]);
      expect(fn).toHaveBeenCalled();
    });

    it('unsubscribe stops data notifications', async () => {
      const fn = vi.fn();
      const unsub = store.subscribeDataChanged(fn);
      unsub();
      await store.save([]);
      expect(fn).not.toHaveBeenCalled();
    });

    it('subscribeCloudSyncStateChanged fires on disconnectCloud', () => {
      const fn = vi.fn();
      store.subscribeCloudSyncStateChanged(fn);
      store.disconnectCloud();
      expect(fn).toHaveBeenCalled();
    });

    it('subscribeDataChanged does not fire on cloudState change', () => {
      const fn = vi.fn();
      store.subscribeDataChanged(fn);
      store.disconnectCloud();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('init() and destroy()', () => {
    it('loads local data on init and notifies', async () => {
      const records = [makePeriodRecord('2024-01-01')];
      const freshStore = new TestStore();
      freshStore.loadLocalMock.mockResolvedValue(records);
      const listener = vi.fn();
      freshStore.subscribeDataChanged(listener);

      freshStore.init();
      await vi.runAllTimersAsync();

      expect(freshStore.testData).toEqual(records);
      expect(listener).toHaveBeenCalled();
      freshStore.destroy();
    });
  });
});
