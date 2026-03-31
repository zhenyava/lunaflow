import { computeIsDeleted, type DailyRecord } from './DailyRecord';
import type { StorageEnvelope } from './StorageEnvelope';
import { parseStorageEnvelope, EnvelopeMigrationService, isEnvelopesEqual } from './StorageEnvelope';
import { STORAGE_CURRENT_VERSION, CLOUD_STORAGE_FOLDER_NAME, CLOUD_STORAGE_FILENAME } from '../constants';
import { IndexedDBProvider } from './IndexedDBProvider';
import { DataStore } from './DataStore';
import type { CloudState } from './DataStore';
import type { LocalStorageProvider } from './LocalStorageProvider';

import type { CloudStorageProvider } from '../cloudStorageProviders/CloudStorageProviderInterface';

import { migrations } from './envelopeMigrations';

export class RecordsStore {
  private _store: DataStore<StorageEnvelope>;
  private _events: readonly DailyRecord[] = [];
  private _dateIndex = new Map<string, number>();
  private _allRecordsInternal: DailyRecord[] = [];
  private _initPromise: Promise<void> | null = null;

  constructor(storageProvider?: LocalStorageProvider) {
    const local = storageProvider || new IndexedDBProvider('lunaflow', 'appData', 'events');
    const migrationService = new EnvelopeMigrationService(STORAGE_CURRENT_VERSION, migrations);

    this._store = new DataStore<StorageEnvelope>(
      local,
      migrationService,
      parseStorageEnvelope,
      this._mergeEnvelopes.bind(this),
      isEnvelopesEqual,
      `${CLOUD_STORAGE_FOLDER_NAME}/${CLOUD_STORAGE_FILENAME}`
    );

    this._store.subscribeDataChanged(() => this._onDataChanged());
  }

  private _mergeEnvelopes(local: StorageEnvelope, cloud: StorageEnvelope): StorageEnvelope {
    const map = new Map<string, DailyRecord>();
    for (const record of [...local.records, ...cloud.records]) {
      const existing = map.get(record.date);
      if (!existing || record.updatedAt > existing.updatedAt) {
        map.set(record.date, record);
      }
    }
    const mergedRecords = Array.from(map.values()).sort((a, b) => this._sortFunc(a, b));
    return {
      ver: Math.max(local.ver, cloud.ver),
      records: mergedRecords
    };
  }

  private _sortFunc(a: DailyRecord, b: DailyRecord): number {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  }

  private _onDataChanged(): void {
    const data = this._store.currentData;
    if (!data) {
      this._events = [];
      this._dateIndex.clear();
      this._allRecordsInternal = [];
      return;
    }

    this._allRecordsInternal = data.records;
    this._events = data.records.filter(r => !r.isDeleted);
    const newIndex = new Map<string, number>();
    for (let i = 0; i < data.records.length; i++) {
      newIndex.set(data.records[i].date, i);
    }
    this._dateIndex = newIndex;
  }

  private async _ensureInitialized(): Promise<void> {
    if (!this._initPromise) {
      throw new Error('[RecordsStore] Method called before initialization. You must call .init() first.');
    }
    await this._initPromise;
  }

  // --- Public API ---

  async init(): Promise<void> {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._store.init();
    return this._initPromise;
  }

  destroy(): void {
    this._store.destroy();
    this._initPromise = null;
    this._allRecordsInternal = [];
    this._events = [];
    this._dateIndex.clear();
  }

  async connectCloud(provider: CloudStorageProvider): Promise<void> {
    await this._store.connectCloud(provider);
  }

  async forceSync(): Promise<void> {
    await this._store.forceSync();
  }

  async disconnectCloud(): Promise<void> {
    await this._store.disconnectCloud();
  }

  subscribeDataChanged(fn: () => void): () => void {
    return this._store.subscribeDataChanged(fn);
  }

  subscribeCloudSyncStateChanged(fn: () => void): () => void {
    return this._store.subscribeCloudSyncStateChanged(fn);
  }

  get cloudState(): CloudState {
    return this._store.cloudState;
  }

  // --- Record mutation API ---

  async upsertRecord(dateStr: string, updates: Partial<DailyRecord>): Promise<void> {
    await this._ensureInitialized();

    const prev = this._allRecordsInternal;
    const now = Date.now();
    const existingIdx = this._dateIndex.get(dateStr);

    let newRecords: DailyRecord[];

    if (existingIdx !== undefined) {
      const newRecord: DailyRecord = { ...prev[existingIdx], ...updates, updatedAt: now };
      newRecord.isDeleted = computeIsDeleted(newRecord);

      newRecords = prev.slice();
      newRecords[existingIdx] = newRecord;
    } else {
      const newRecord: DailyRecord = { date: dateStr, updatedAt: now, ...updates };
      newRecord.isDeleted = computeIsDeleted(newRecord);

      newRecords = prev.slice();
      newRecords.push(newRecord);
      newRecords.sort((a, b) => this._sortFunc(a, b));
    }

    // Rely on DataStore's save() to trigger _onDataChanged() via subscription.
    // This avoids double-calculating events and index updates.
    await this._store.save({ ver: STORAGE_CURRENT_VERSION, records: newRecords });
  }

  async getRecord(dateStr: string): Promise<DailyRecord | undefined> {
    await this._ensureInitialized();
    const idx = this._dateIndex.get(dateStr);
    if (idx === undefined) return undefined;

    // Use internal cache for zero-lag consistency after local mutations
    const records = this._allRecordsInternal;
    const record = records[idx];
    return record.isDeleted ? undefined : record;
  }

  get events(): readonly DailyRecord[] {
    return this._events;
  }

  get allRecords(): readonly DailyRecord[] | null {
    return this._allRecordsInternal.length > 0 ? this._allRecordsInternal : null;
  }
}
