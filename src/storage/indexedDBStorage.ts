import type { LocalStorageProvider } from './LocalStorageProvider';

export class IndexedDBProvider implements LocalStorageProvider {

  private readonly _dbName: string;
  private readonly _storeName: string;
  private readonly _key: string;
  private _dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string, storeName: string, key: string) {
    this._dbName = dbName;
    this._storeName = storeName;
    this._key = key;
  }

  private _openDB(): Promise<IDBDatabase> {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this._dbName);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(this._storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this._dbPromise;
  }

  async read(): Promise<unknown> {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readonly');
      const request = tx.objectStore(this._storeName).get(this._key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async write(data: unknown): Promise<void> {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      const request = tx.objectStore(this._storeName).put(data, this._key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async close(): Promise<void> {
    if (this._dbPromise) {
      const db = await this._dbPromise;
      db.close();
      this._dbPromise = null;
    }
  }
}
