import type { CloudStorageProvider } from '../cloudStorageProviders/CloudStorageProviderInterface';
import type { LocalStorageProvider } from './LocalStorageProvider';
import type { DataMigrationService } from './DataMigrationService';

export type CloudState = 'unsynced' | 'uploading' | 'synced' | 'syncing';

export class DataStore<T> {
  protected data: T | null = null;
  private _cloudStorageProvider: CloudStorageProvider | null = null;
  private _cloudState: CloudState = 'unsynced';
  private _dataListeners = new Set<() => void>();
  private _stateListeners = new Set<() => void>();
  private _uploadTimer: ReturnType<typeof setTimeout> | null = null;
  private _initPromise: Promise<void> | null = null;
  private _connectPromise: Promise<void> | null = null;
  private _syncPromise: Promise<void> | null = null;

  private _local: LocalStorageProvider;
  private _migrationService: DataMigrationService<T> | null;
  private _validator: (raw: unknown) => T | null;
  private _merger: (local: T, cloud: T) => T;
  private _isEqual: (a: T, b: T) => boolean;
  public readonly cloudPath: string;

  constructor(
    local: LocalStorageProvider,
    migrationService: DataMigrationService<T> | null,
    validator: (raw: unknown) => T | null,
    merger: (local: T, cloud: T) => T,
    isEqual: (a: T, b: T) => boolean,
    cloudPath: string
  ) {
    if (!local) throw new Error('[DataStore] Local storage provider is mandatory');
    if (!validator) throw new Error('[DataStore] Validator function is mandatory');
    if (!merger) throw new Error('[DataStore] Merger function is mandatory');
    if (!isEqual) throw new Error('[DataStore] Equality checker is mandatory');

    this._local = local;
    this._migrationService = migrationService;
    this._validator = validator;
    this._merger = merger;
    this._isEqual = isEqual;
    this.cloudPath = cloudPath;
  }

  // --- Public state ---

  get cloudState(): CloudState {
    return this._cloudState;
  }

  get currentData(): T | null {
    return this.data;
  }

  // --- Subscriber pattern ---

  subscribeDataChanged(fn: () => void): () => void {
    this._dataListeners.add(fn);
    return () => this._dataListeners.delete(fn);
  }

  subscribeCloudSyncStateChanged(fn: () => void): () => void {
    this._stateListeners.add(fn);
    return () => this._stateListeners.delete(fn);
  }

  // --- Private setters ---

  private setData(data: T | null): void {
    console.log("set data " + data);
    this.data = data;
    this._dataListeners.forEach(fn => fn());
  }

  private setCloudState(state: CloudState): void {
    this._cloudState = state;
    this._stateListeners.forEach(fn => fn());
  }

  private async ensureInitialized(): Promise<void> {
    if (!this._initPromise) {
      throw new Error(`[DataStore] Method called before initialization. You must call .init() first.`);
    }
    await this._initPromise;
  }

  // --- Public API ---

  async init(): Promise<void> {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        const raw = await this._local.read();
        if (raw === null) {
          this.setData(null);
          return;
        }
        let parsed = this._validator(raw);
        if (parsed && this._migrationService) {
          parsed = this._migrationService.migrate(parsed);
        }
        this.setData(parsed ?? null);
      } catch (e) {
        console.error('[DataStore] Failed to load from local storage', e);
        this.setData(null);
      }
    })();

    return this._initPromise;
  }

  async save(data: T): Promise<void> {
    await this.ensureInitialized();
    this.setData(data);
    try {
      await this._local.write(data);
    } catch (e) {
      console.error('[DataStore] Failed to save to local storage', e);
    }
    this.setCloudState('unsynced');
    this.scheduleUpload(data);
  }

  async forceSync(): Promise<void> {
    if (this._syncPromise) return this._syncPromise;
    this._syncPromise = (async () => {
      await this.ensureInitialized();
      if (!this._cloudStorageProvider || this._cloudState === 'uploading') return;
      this.setCloudState('syncing');

      try {
        const raw = await this._cloudStorageProvider.fetchData(this.cloudPath);
        let cloud = this._validator(raw);
        if (!cloud) {
          throw new Error('Invalid data from cloud');
        }

        if (this._migrationService) {
          cloud = this._migrationService.migrate(cloud);
        }

        const local = this.data;
        if (!local) {
          this.setData(cloud);
          await this._local.write(cloud);
          this.setCloudState('synced');
          return;
        }

        const merged = this._merger(local, cloud);

        if (!this._isEqual(merged, local)) {
          this.setData(merged);
          await this._local.write(merged);
        }

        if (!this._isEqual(merged, cloud)) {
          this.setCloudState('unsynced');
          this.scheduleUpload(merged);
        } else {
          this.setCloudState('synced');
        }
      } catch (e) {
        console.error('[DataStore] forceSync failed', e);
        this.setCloudState('unsynced');
      } finally {
        this._syncPromise = null;
      }
    })();

    return this._syncPromise;
  }

  async connectCloud(provider: CloudStorageProvider): Promise<void> {
    if (this._connectPromise) return this._connectPromise;
    
    this._connectPromise = (async () => {
      try {
        await this.ensureInitialized();
        const ok = await provider.ensureFileExists(this.cloudPath);
        if (!ok) {
          throw new Error('[DataStore] Failed to ensure cloud file exists');
        }
        this._cloudStorageProvider = provider;
        await this.forceSync();
      } finally {
        this._connectPromise = null;
      }
    })();

    return this._connectPromise;
  }

  async disconnectCloud(): Promise<void> {
    await this.ensureInitialized();
    this._cloudStorageProvider = null;
    this.setCloudState('unsynced');
  }

  destroy(): void {
    if (this._uploadTimer !== null) {
      clearTimeout(this._uploadTimer);
      this._uploadTimer = null;
    }
    this._dataListeners.clear();
    this._stateListeners.clear();
    this._cloudStorageProvider = null;
    this._cloudState = 'unsynced';
    this.data = null;
    this._initPromise = null;
    this._connectPromise = null;
    this._syncPromise = null;
  }

  // --- Private helpers ---

  private scheduleUpload(data: T): void {
    if (!this._cloudStorageProvider) return;
    if (this._uploadTimer !== null) clearTimeout(this._uploadTimer);

    this._uploadTimer = setTimeout(async () => {
      this._uploadTimer = null;
      if (!this._cloudStorageProvider) return;
      this.setCloudState('uploading');
      try {
        await this._cloudStorageProvider.uploadData(this.cloudPath, data);
        this.setCloudState('synced');
      } catch {
        this.setCloudState('unsynced');
      }
    }, 2000);
  }
}
