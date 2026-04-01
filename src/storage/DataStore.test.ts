import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataStore } from './DataStore';
import type { LocalStorageProvider } from './LocalStorageProvider';
import type { DataMigrationService } from './DataMigrationService';
import type { CloudStorageProvider } from '../cloudStorageProviders/CloudStorageProviderInterface';

describe('DataStore', () => {
  interface TestData {
    val: string;
    v: number;
  }

  let localProvider: LocalStorageProvider;
  let migrationService: DataMigrationService<TestData>;
  let validator: (raw: unknown) => TestData | null;
  let merger: (l: TestData, r: TestData) => TestData;
  let isEqual: (a: TestData, b: TestData) => boolean;
   let store: DataStore<TestData>;
  let cloudProvider: CloudStorageProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => { });

    localProvider = {
      read: vi.fn(async () => ({ val: 'local', v: 1 })),
      write: vi.fn(async () => { }),
    };

    migrationService = {
      migrate: vi.fn((d: TestData) => d),
    } as unknown as DataMigrationService<TestData>;

    validator = vi.fn((raw: unknown) => raw as TestData);
    merger = vi.fn((l: TestData, r: TestData) => ({ ...l, val: `${l.val}+${r.val}`, v: l.v }));
    isEqual = vi.fn((a: TestData, b: TestData) => a.val === b.val && a.v === b.v);

    store = new DataStore<TestData>(
      localProvider,
      migrationService,
      validator,
      merger,
      isEqual,
      'test/path.json'
    );

    cloudProvider = {
      id: 'test-cloud',
      name: 'Test Cloud',
      checkFileExists: vi.fn(async () => true),
      downloadFile: vi.fn(async () => ({ val: 'cloud', v: 1 })),
      uploadFile: vi.fn(async () => { }),
    } as unknown as CloudStorageProvider;
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Constructor & Dependency Integrity', () => {
    it('throws in constructor if local provider is missing', () => {
      expect(() => new DataStore(null as unknown as LocalStorageProvider, null, validator, merger, isEqual, 'path'))
        .toThrow('Local storage provider is mandatory');
    });

    it('throws in constructor if validator is missing', () => {
      expect(() => new DataStore(localProvider, null, null as unknown as (raw: unknown) => TestData | null, merger, isEqual, 'path'))
        .toThrow('Validator function is mandatory');
    });

  });

  describe('Strict Lifecycle: init mandatory', () => {
    const methods = [
      { name: 'save()', call: () => store.save({ val: 'new', v: 1 }) },
      { name: 'pullDataFromCloud()', call: () => store.pullDataFromCloud() },
      { name: 'connectCloud()', call: () => store.connectCloud(cloudProvider) },
      { name: 'disconnectCloud()', call: () => store.disconnectCloud() },
    ];

    it.each(methods)(
      'throws if $name is called before init()', 
      async ({ call }) => {
        await expect(call()).rejects.toThrow(
          'Method called before initialization. You must call .init() first.'
        );
      }
    );

    it('Strict Lifecycle: awaits pending init()', async () => {
      let resolveRead: (v: unknown) => void;
      localProvider.read = vi.fn(() => new Promise(resolve => { resolveRead = resolve; }));

      const initPromise = store.init();
      const savePromise = store.save({ val: 'new', v: 1 });

      expect(localProvider.write).not.toHaveBeenCalled();

      resolveRead!({ val: 'local', v: 1 });
      await initPromise;
      await savePromise;

      expect(localProvider.write).toHaveBeenCalled();
    });
  });

  describe('init() logic', () => {
    it('orchestrates: read from local cache -> validate -> migrate -> setData', async () => {
      const raw = { raw: 'data' };
      const parsed = { val: 'parsed', v: 1 };
      const migrated = { val: 'migrated', v: 1 };

      vi.mocked(localProvider.read).mockResolvedValue(raw);
      vi.mocked(validator).mockReturnValue(parsed);
      vi.mocked(migrationService.migrate).mockReturnValue(migrated);

      await store.init();

      expect(localProvider.read).toHaveBeenCalled();
      expect(validator).toHaveBeenCalledWith(raw);
      expect(migrationService.migrate).toHaveBeenCalledWith(parsed);
      expect(store.currentData).toEqual(migrated);
    });

    it('is idempotent, init() only call once', async () => {
      store.init();
      store.init();
      await vi.runAllTimersAsync();
      expect(localProvider.read).toHaveBeenCalledTimes(1);
    });

    it('handles null local data gracefully (fresh start)', async () => {
      vi.mocked(localProvider.read).mockResolvedValue(null);
      await store.init();
      expect(store.currentData).toBeNull();
      expect(validator).not.toHaveBeenCalled();
    });

    it('handles corrupt local data (validator returns null)', async () => {
      vi.mocked(validator).mockReturnValue(null);
      await store.init();
      expect(store.currentData).toBeNull();
    });

    it('handles local provider errors', async () => {
      vi.mocked(localProvider.read).mockRejectedValue(new Error('IO Error'));
      await store.init();
      expect(store.currentData).toBeNull();
    });
  });



  describe('save() logic', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('orchestrates: setData -> writeLocal -> scheduleUpload', async () => {
      await store.connectCloud(cloudProvider);
      const newData = { val: 'new', v: 1 };

      await store.save(newData);

      expect(store.currentData).toEqual(newData);
      expect(localProvider.write).toHaveBeenCalledWith(newData);

      // Debounce check
      expect(cloudProvider.uploadFile).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadFile).toHaveBeenCalledWith('test/path.json', newData);
    });

    it('transitions cloudState: unsynced -> uploading -> synced', async () => {
      await store.connectCloud(cloudProvider);

      // Make uploadFile hang so we can catch the 'uploading' state
      let resolveUpload: () => void;
      const uploadPromise = new Promise<void>((resolve) => { resolveUpload = resolve; });
      vi.mocked(cloudProvider.uploadFile).mockReturnValue(uploadPromise);

      await store.save({ val: 'new', v: 1 });
      expect(store.cloudState).toBe('unsynced');

      // Trigger the timer
      await vi.advanceTimersByTimeAsync(2000);

      // Now it should be uploading
      expect(store.cloudState).toBe('uploading');

      // Resolve the upload
      resolveUpload!();
      await vi.runAllTicks(); // Process the microtasks after resolution

      expect(store.cloudState).toBe('synced');
    });
    });

    it('save() works with data === null (first user edit)', async () => {
      // Create a fresh store with null local data
      const freshLocalProvider = { 
        read: vi.fn(async () => null), 
        write: vi.fn(async () => {}) 
      };
      const freshStore = new DataStore<TestData>(
        freshLocalProvider,
        migrationService,
        validator,
        merger,
        isEqual,
        'test/path.json'
      );
      await freshStore.init();
      expect(freshStore.currentData).toBeNull();

      const newData = { val: 'first', v: 1 };
      await freshStore.save(newData);

      expect(freshStore.currentData).toEqual(newData);
      expect(freshLocalProvider.write).toHaveBeenCalledWith(newData);
      // Should schedule upload if cloud provider connected
      // but we don't have cloud provider in this test
    });

  describe('pullDataFromCloud() logic', () => {
    beforeEach(async () => {
      await store.init();
      await store.connectCloud(cloudProvider);
      vi.mocked(cloudProvider.uploadFile).mockClear();
      vi.mocked(localProvider.write).mockClear();
    });

    it('orchestrates: fetch -> validate -> migrate -> merge -> resolve conflicts', async () => {
      const localData = { val: 'local', v: 1 };
      const cloudData = { val: 'cloud', v: 1 };
      const mergedData = { val: 'merged', v: 1 };

      (store as unknown as { data: TestData }).data = localData;
      vi.mocked(cloudProvider.downloadFile).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);
      vi.mocked(merger).mockReturnValue(mergedData);
      vi.mocked(isEqual).mockImplementation((a, b) => a.val === b.val);

      await store.pullDataFromCloud();

      expect(cloudProvider.downloadFile).toHaveBeenCalledWith('test/path.json');
      expect(validator).toHaveBeenCalledWith(cloudData);
      expect(migrationService.migrate).toHaveBeenCalledWith(cloudData);
      expect(merger).toHaveBeenCalledWith(localData, cloudData);

      // Since merged != local, it should save locally
      expect(localProvider.write).toHaveBeenCalledWith(mergedData);
      // Since merged != cloud, it should schedule upload
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadFile).toHaveBeenCalledWith('test/path.json', mergedData);
    });

    it('aborts and transitions to unsynced if cloud data is invalid', async () => {
      vi.mocked(validator).mockReturnValue(null);
      await store.pullDataFromCloud();
      expect(store.cloudState).toBe('unsynced');
      expect(localProvider.write).not.toHaveBeenCalled();
    });

    it('sets synced if merged data is already equal to both local and cloud', async () => {
      const sameData = { val: 'same', v: 1 };
      (store as unknown as { data: TestData }).data = sameData;
      vi.mocked(cloudProvider.downloadFile).mockResolvedValue(sameData);
      vi.mocked(validator).mockReturnValue(sameData);
      vi.mocked(isEqual).mockReturnValue(true);

      await store.pullDataFromCloud();
      expect(store.cloudState).toBe('synced');
      expect(localProvider.write).not.toHaveBeenCalled();
    });

    it('adopts cloud data immediately if local data is null', async () => {
      const cloudData = { val: 'cloud', v: 1 };
      (store as unknown as { data: TestData | null }).data = null;
      vi.mocked(cloudProvider.downloadFile).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);

      await store.pullDataFromCloud();

      expect(store.currentData).toEqual(cloudData);
      expect(localProvider.write).toHaveBeenCalledWith(cloudData);
      expect(store.cloudState).toBe('synced');
    });

    it('pullDataFromCloud() saves empty cloud envelope to local storage', async () => {
      const emptyCloudData = { val: '', v: 0 };
      (store as unknown as { data: TestData | null }).data = null;
      vi.mocked(cloudProvider.downloadFile).mockResolvedValue(emptyCloudData);
      vi.mocked(validator).mockReturnValue(emptyCloudData);

      await store.pullDataFromCloud();

      expect(store.currentData).toEqual(emptyCloudData);
      expect(localProvider.write).toHaveBeenCalledWith(emptyCloudData);
      expect(store.cloudState).toBe('synced');
    });

    it('is idempotent: concurrent calls return the same promise', async () => {
      vi.mocked(cloudProvider.downloadFile).mockClear();

      const p1 = store.pullDataFromCloud();
      const p2 = store.pullDataFromCloud();

      await Promise.all([p1, p2]);

      expect(cloudProvider.downloadFile).toHaveBeenCalledTimes(1);
    });

    it('updates local only if merged data matches cloud but differs from local', async () => {
      const localData = { val: 'old', v: 1 };
      const cloudData = { val: 'new', v: 1 };
      
      (store as unknown as { data: TestData }).data = localData;
      vi.mocked(cloudProvider.downloadFile).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);
      // Merger returns cloudData (last write wins)
      vi.mocked(merger).mockReturnValue(cloudData);
      // isEqual(merged, local) -> false
      // isEqual(merged, cloud) -> true
      vi.mocked(isEqual).mockImplementation((a, b) => a.val === b.val);

      await store.pullDataFromCloud();

      expect(localProvider.write).toHaveBeenCalledWith(cloudData);
      expect(store.cloudState).toBe('synced');
      expect(cloudProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('handles missing cloud file error', async () => {
      vi.mocked(cloudProvider.downloadFile).mockRejectedValue(new Error('File not found'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await store.pullDataFromCloud();
      
      expect(console.error).toHaveBeenCalledWith('[DataStore] pullDataFromCloud failed', expect.any(Error));
      expect(store.cloudState).toBe('unsynced');
      expect(cloudProvider.downloadFile).toHaveBeenCalledWith('test/path.json');
    });
  });

  describe('connectCloud() logic', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('pull data if file exists', async () => {
      vi.mocked(cloudProvider.checkFileExists).mockResolvedValue(true);
      const pullSpy = vi.spyOn(store, 'pullDataFromCloud');
      await store.connectCloud(cloudProvider);

      expect(cloudProvider.checkFileExists).toHaveBeenCalledWith('test/path.json');
      expect(pullSpy).toHaveBeenCalled();
    });

    it('upload cached data if no cloud file', async () => {
      vi.mocked(cloudProvider.checkFileExists).mockResolvedValue(false);
      (store as unknown as { data: TestData }).data = { val: 'local', v: 1 };
      const pullSpy = vi.spyOn(store, 'pullDataFromCloud');
      
      await store.connectCloud(cloudProvider);

      expect(cloudProvider.checkFileExists).toHaveBeenCalledWith('test/path.json');
      expect(pullSpy).not.toHaveBeenCalled();
      
      // Upload should be scheduled
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadFile).toHaveBeenCalledWith('test/path.json', { val: 'local', v: 1 });
    });

    it('does nothing when cloud file does not exist AND data is null', async () => {
      vi.mocked(cloudProvider.checkFileExists).mockResolvedValue(false);
      (store as unknown as { data: TestData | null }).data = null;
      const pullSpy = vi.spyOn(store, 'pullDataFromCloud');
      
      await store.connectCloud(cloudProvider);

      expect(cloudProvider.checkFileExists).toHaveBeenCalledWith('test/path.json');
      expect(pullSpy).not.toHaveBeenCalled();
      // No upload should be scheduled
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('is idempotent: concurrent calls return the same promise', async () => {
      const p1 = store.connectCloud(cloudProvider);
      const p2 = store.connectCloud(cloudProvider);

      await Promise.all([p1, p2]);

      // checkFileExists is called once in connectCloud
      expect(cloudProvider.checkFileExists).toHaveBeenCalledTimes(1);
    });
  });
});
