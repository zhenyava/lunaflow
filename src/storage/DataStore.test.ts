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
      ensureFileExists: vi.fn(async () => true),
      fetchData: vi.fn(async () => ({ val: 'cloud', v: 1 })),
      uploadData: vi.fn(async () => { }),
    } as unknown as CloudStorageProvider;
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Contract & Dependency Integrity', () => {
    it('throws in constructor if local provider is missing', () => {
      expect(() => new DataStore(null as unknown as LocalStorageProvider, null, validator, merger, isEqual, 'path'))
        .toThrow('Local storage provider is mandatory');
    });

    it('throws in constructor if validator is missing', () => {
      expect(() => new DataStore(localProvider, null, null as unknown as (raw: unknown) => TestData | null, merger, isEqual, 'path'))
        .toThrow('Validator function is mandatory');
    });

    it('Strict Lifecycle: throws if methods called before init()', async () => {
      const methods = [
        () => store.save({ val: 'new', v: 1 }),
        () => store.forceSync(),
        () => store.connectCloud(cloudProvider),
        () => store.disconnectCloud(),
      ];

      for (const call of methods) {
        await expect(call()).rejects.toThrow('Method called before initialization. You must call .init() first.');
      }
    });

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
      expect(cloudProvider.uploadData).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadData).toHaveBeenCalledWith('test/path.json', newData);
    });

    it('transitions cloudState: unsynced -> uploading -> synced', async () => {
      await store.connectCloud(cloudProvider);

      // Make uploadData hang so we can catch the 'uploading' state
      let resolveUpload: () => void;
      const uploadPromise = new Promise<void>((resolve) => { resolveUpload = resolve; });
      vi.mocked(cloudProvider.uploadData).mockReturnValue(uploadPromise);

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

  describe('forceSync() logic', () => {
    beforeEach(async () => {
      await store.init();
      await store.connectCloud(cloudProvider);
      vi.mocked(cloudProvider.uploadData).mockClear();
      vi.mocked(localProvider.write).mockClear();
    });

    it('orchestrates: fetch -> validate -> migrate -> merge -> resolve conflicts', async () => {
      const localData = { val: 'local', v: 1 };
      const cloudData = { val: 'cloud', v: 1 };
      const mergedData = { val: 'merged', v: 1 };

      (store as unknown as { data: TestData }).data = localData;
      vi.mocked(cloudProvider.fetchData).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);
      vi.mocked(merger).mockReturnValue(mergedData);
      vi.mocked(isEqual).mockImplementation((a, b) => a.val === b.val);

      await store.forceSync();

      expect(cloudProvider.fetchData).toHaveBeenCalledWith('test/path.json');
      expect(validator).toHaveBeenCalledWith(cloudData);
      expect(migrationService.migrate).toHaveBeenCalledWith(cloudData);
      expect(merger).toHaveBeenCalledWith(localData, cloudData);

      // Since merged != local, it should save locally
      expect(localProvider.write).toHaveBeenCalledWith(mergedData);
      // Since merged != cloud, it should schedule upload
      await vi.advanceTimersByTimeAsync(2000);
      expect(cloudProvider.uploadData).toHaveBeenCalledWith('test/path.json', mergedData);
    });

    it('aborts and transitions to unsynced if cloud data is invalid', async () => {
      vi.mocked(validator).mockReturnValue(null);
      await store.forceSync();
      expect(store.cloudState).toBe('unsynced');
      expect(localProvider.write).not.toHaveBeenCalled();
    });

    it('sets synced if merged data is already equal to both local and cloud', async () => {
      const sameData = { val: 'same', v: 1 };
      (store as unknown as { data: TestData }).data = sameData;
      vi.mocked(cloudProvider.fetchData).mockResolvedValue(sameData);
      vi.mocked(validator).mockReturnValue(sameData);
      vi.mocked(isEqual).mockReturnValue(true);

      await store.forceSync();
      expect(store.cloudState).toBe('synced');
      expect(localProvider.write).not.toHaveBeenCalled();
    });

    it('adopts cloud data immediately if local data is null', async () => {
      const cloudData = { val: 'cloud', v: 1 };
      (store as unknown as { data: TestData | null }).data = null;
      vi.mocked(cloudProvider.fetchData).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);

      await store.forceSync();

      expect(store.currentData).toEqual(cloudData);
      expect(localProvider.write).toHaveBeenCalledWith(cloudData);
      expect(store.cloudState).toBe('synced');
    });

    it('updates local only if merged data matches cloud but differs from local', async () => {
      const localData = { val: 'old', v: 1 };
      const cloudData = { val: 'new', v: 1 };
      
      (store as unknown as { data: TestData }).data = localData;
      vi.mocked(cloudProvider.fetchData).mockResolvedValue(cloudData);
      vi.mocked(validator).mockReturnValue(cloudData);
      // Merger returns cloudData (last write wins)
      vi.mocked(merger).mockReturnValue(cloudData);
      // isEqual(merged, local) -> false
      // isEqual(merged, cloud) -> true
      vi.mocked(isEqual).mockImplementation((a, b) => a.val === b.val);

      await store.forceSync();

      expect(localProvider.write).toHaveBeenCalledWith(cloudData);
      expect(store.cloudState).toBe('synced');
      expect(cloudProvider.uploadData).not.toHaveBeenCalled();
    });
  });

  describe('connectCloud() logic', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('ensures file exists and triggers immediate forceSync', async () => {
      const forceSyncSpy = vi.spyOn(store, 'forceSync');
      await store.connectCloud(cloudProvider);

      expect(cloudProvider.ensureFileExists).toHaveBeenCalledWith('test/path.json');
      expect(forceSyncSpy).toHaveBeenCalled();
    });

    it('fails if file cannot be ensured', async () => {
      vi.mocked(cloudProvider.ensureFileExists).mockResolvedValue(false);
      await expect(store.connectCloud(cloudProvider)).rejects.toThrow('Failed to ensure cloud file exists');
    });
  });
});
