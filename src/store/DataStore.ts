import type { RemoteStorageProvider } from '../storageProviders/RemoteStorageProviderInterface';

export function eventsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type CloudState = 'unsynced' | 'uploading' | 'synced' | 'syncing';

export abstract class DataStore<T> {
  protected data: T | null = null;
  protected _remoteStorageProvider: RemoteStorageProvider | null = null;
  private _cloudState: CloudState = 'unsynced';
  private _dataListeners = new Set<() => void>();
  private _stateListeners = new Set<() => void>();
  private _uploadTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Abstract: subclasses define their stable logical file identifier ---
  abstract get fileId(): string;

  // --- Abstract: local persistence ---
  protected abstract loadLocal(): Promise<T | null>;
  protected abstract saveLocal(data: T): Promise<void>;

  // --- Abstract: sync ---
  protected abstract merge(local: T, remote: T): T;
  protected abstract fetchFromCloud(fileId: string): Promise<T>;
  protected abstract prepareDataToCloud(data: T): unknown;

  // --- Public state ---

  get cloudState(): CloudState {
    return this._cloudState;
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

  // --- Private setters: combine assignment + notification ---

  private setData(data: T): void {
    this.data = data;
    this.onDataChanged?.(data);
    this._dataListeners.forEach(fn => fn());
  }

  private setCloudState(state: CloudState): void {
    this._cloudState = state;
    this._stateListeners.forEach(fn => fn());
  }

  // Optional hook for subclasses to react to data changes (e.g. update derived caches)
  protected onDataChanged?(data: T): void;

  // --- Public API ---

  async save(data: T): Promise<void> {
    this.setData(data);
    await this.saveLocal(data);
    this.scheduleUpload(data);
  }

  async forceSync(): Promise<void> {
    if (!this._remoteStorageProvider || this._cloudState === 'uploading') return;
    this.setCloudState('syncing');

    try {
      const remote = await this.fetchFromCloud(this.fileId);
      const local = this.data as T;
      const merged = this.merge(local, remote);

      if (!eventsEqual(merged, local)) {
        this.setData(merged);
        await this.saveLocal(merged);
      }
      if (!eventsEqual(merged, remote)) {
        this.scheduleUpload(merged);
      } else {
        this.setCloudState('synced');
      }
    } catch {
      this.setCloudState('unsynced');
    }
  }

  // --- Remote connection lifecycle ---

  async connectRemote(provider: RemoteStorageProvider): Promise<void> {
    this._remoteStorageProvider = provider;
    const ok = await provider.ensureFileExists(this.fileId);
    if (!ok) {
      this._remoteStorageProvider = null;
      throw new Error('Failed to ensure remote file exists');
    }
    await this.forceSync();
  }

  disconnectRemote(): void {
    this._remoteStorageProvider = null;
    this.setCloudState('unsynced');
  }

  // --- Lifecycle ---

  init(): void {
    this.loadLocal().then(data => {
      if (data !== null) {
        this.setData(data);
      }
    });
  }

  destroy(): void {
    if (this._uploadTimer !== null) {
      clearTimeout(this._uploadTimer);
      this._uploadTimer = null;
    }
    this._dataListeners.clear();
    this._stateListeners.clear();
    this._remoteStorageProvider = null;
    this._cloudState = 'unsynced';
    this.data = null;
  }

  // --- Private helpers ---

  private scheduleUpload(data: T): void {
    if (!this._remoteStorageProvider) return;
    if (this._uploadTimer !== null) clearTimeout(this._uploadTimer);

    this._uploadTimer = setTimeout(async () => {
      this._uploadTimer = null;
      if (!this._remoteStorageProvider) return;
      this.setCloudState('uploading');
      try {
        const payload = this.prepareDataToCloud(data);
        await this._remoteStorageProvider.uploadData(this.fileId, payload);
        this.setCloudState('synced');
      } catch {
        this.setCloudState('unsynced');
      }
    }, 2000);
  }
}
