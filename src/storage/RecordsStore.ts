import type { DailyRecord } from './DailyRecord';
import { validateDailyRecords } from './DailyRecord';
import type { StorageEnvelope } from './StorageEnvelope';
import { parseStorageEnvelope } from './StorageEnvelope';
import { STORAGE_CURRENT_VERSION, CLOUD_STORAGE_FOLDER_NAME, CLOUD_STORAGE_FILENAME } from '../constants';
import * as idb from './indexedDBStorage';
import { migrations } from './migrationData';
import { DataStore } from './DataStore';

export class RecordsStore extends DataStore<DailyRecord[]> {
  get cloudPath(): string {
    return `${CLOUD_STORAGE_FOLDER_NAME}/${CLOUD_STORAGE_FILENAME}`;
  }

  private readonly DB_NAME = 'lunaflow';
  private readonly STORE_NAME = 'appData';
  private readonly STORE_KEY = 'events';

  protected async loadLocal(): Promise<DailyRecord[] | null> {
    try {
      const raw = await idb.read(this.DB_NAME, this.STORE_NAME, this.STORE_KEY);
      if (raw === null) return [];
      if (!Array.isArray(raw)) return [];
      return validateDailyRecords(raw);
    } catch (e) {
      console.error('Failed to load from IndexedDB', e);
      return [];
    }
  }

  protected async saveLocal(data: DailyRecord[]): Promise<void> {
    try {
      await idb.write(this.DB_NAME, this.STORE_NAME, this.STORE_KEY, data);
    } catch (e) {
      console.error('Failed to save to IndexedDB', e);
    }
  }

  protected merge(local: DailyRecord[], cloud: DailyRecord[]): DailyRecord[] {
    const map = new Map<string, DailyRecord>();
    for (const record of [...local, ...cloud]) {
      const existing = map.get(record.date);
      if (!existing || record.updatedAt > existing.updatedAt) {
        map.set(record.date, record);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  protected async fetchFromCloud(cloudPath: string): Promise<DailyRecord[]> {
    if (!this._cloudStorageProvider) throw new Error('No storage provider');
    const raw = await this._cloudStorageProvider.fetchData(cloudPath);
    const envelope = parseStorageEnvelope(raw);
    if (!envelope) return [];
    return this.migrateData(envelope).records;
  }

  protected prepareDataToCloud(data: DailyRecord[]): StorageEnvelope {
    return { ver: STORAGE_CURRENT_VERSION, records: data };
  }

  private migrateData(envelope: StorageEnvelope): { records: DailyRecord[]; wasMigrated: boolean } {
    let currentVer = envelope.ver;
    let records = envelope.records;

    const initialVer = currentVer;

    while (currentVer < STORAGE_CURRENT_VERSION && currentVer < migrations.length) {
      const migrateFn = migrations[currentVer];
      if (migrateFn) {
        records = migrateFn(records) as DailyRecord[];
        currentVer++;
      } else {
        break;
      }
    }

    return { records, wasMigrated: initialVer < currentVer };
  }

  override init(): void {
    idb.openDB(this.DB_NAME, this.STORE_NAME);
    super.init();
  }

  override destroy(): void {
    super.destroy();
    idb.closeDB(this.DB_NAME, this.STORE_NAME);
  }

  // Derived views for UI

  private _events: readonly DailyRecord[] = [];

  protected override onDataChanged(data: DailyRecord[]): void {
    this._events = data.filter(r => !r.isDeleted);
  }

  get events(): readonly DailyRecord[] {
    return this._events;
  }

  get allRecords(): readonly DailyRecord[] | null {
    return this.data;
  }
}

