import type { RemoteStorageProvider } from '../storageProviders/RemoteStorageProviderInterface';

export function eventsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type CloudState = 'unsynced' | 'uploading' | 'synced' | 'syncing';

export abstract class DataStore<T> {
  protected data: T | null = null;
  protected _remoteStorageProvider: RemoteStorageProvider | null = null;
  private _cloudState: CloudState = 'unsynced';
  private _listeners = new Set<() => void>();
  private _uploadTimer: ReturnType<typeof setTimeout> | null = null;

  // Callback for CalendarApp to handle auth errors (e.g. call authProvider.signOut())
  onSyncError: (() => void) | null = null;

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

  subscribe(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  protected notify(): void {
    this._listeners.forEach(fn => fn());
  }

  // --- Public API ---

  async save(data: T): Promise<void> {
    this.data = data;
    this.notify();
    await this.saveLocal(data);
    this.scheduleUpload(data);
  }

  async forceSync(): Promise<void> {
    if (!this._remoteStorageProvider || this._cloudState === 'uploading') return;
    this._cloudState = 'syncing'
    this.notify()

    try {
      const remote = await this.fetchFromCloud(this.fileId);
      const local = this.data as T;
      const merged = this.merge(local, remote);

      if (!eventsEqual(merged, local)) {
        this.data = merged;
        await this.saveLocal(merged);
      }
      if (!eventsEqual(merged, remote)) {
        this.scheduleUpload(merged)
      } else {
        this._cloudState = 'synced';
        this.notify();
      }
    } catch (error) {
      await this.handleSyncError(error);
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
    this._cloudState = 'unsynced';
    this.notify();
  }

  // --- Lifecycle ---

  init(): void {
    this.loadLocal().then(data => {
      if (data !== null) {
        this.data = data;
        this.notify();
      }
    });
  }

  destroy(): void {
    if (this._uploadTimer !== null) {
      clearTimeout(this._uploadTimer);
      this._uploadTimer = null;
    }
    this._listeners.clear();
    this._remoteStorageProvider = null;
    this._cloudState = 'unsynced';
    this.onSyncError = null;
    this.data = null;
  }

  // --- Private helpers ---

  private scheduleUpload(data: T): void {
    if (!this._remoteStorageProvider) return;
    if (this._uploadTimer !== null) clearTimeout(this._uploadTimer);

    this._uploadTimer = setTimeout(async () => {
      this._uploadTimer = null;
      if (!this._remoteStorageProvider) return;
      this._cloudState = 'uploading';
      this.notify();
      try {
        const payload = this.prepareDataToCloud(data);
        await this._remoteStorageProvider.uploadData(this.fileId, payload);

        this._cloudState = 'synced';
        this.notify();
      } catch (error) {
        await this.handleSyncError(error);
      }
    }, 2000);
  }

  private async handleSyncError(error: unknown): Promise<void> {
    this._cloudState = 'unsynced';
    const err = error as { status?: number; message?: string };
    if (err.status === 401 || err.message === 'Unauthorized') {
      this._remoteStorageProvider = null;
      this.onSyncError?.();
    }
    this.notify();
  }
}
