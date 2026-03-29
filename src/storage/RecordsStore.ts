import type { DailyRecord } from './DailyRecord';
import type { CloudStorageProvider } from '../cloudStorageProviders/CloudStorageProviderInterface';
import { validateDailyRecords, computeIsDeleted } from './DailyRecord';
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

  protected async fetchFromCloud(provider: CloudStorageProvider, cloudPath: string): Promise<DailyRecord[]> {
    const raw = await provider.fetchData(cloudPath);
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

  // --- Record mutation API ---
  upsertRecord(dateStr: string, updates: Partial<DailyRecord>): void {
    const prev = this.data ?? [];
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

      // Создаем копию, добавляем в конец и сортируем быстрым компаратором
      newRecords = prev.slice();
      newRecords.push(newRecord);
      newRecords.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });
    }

    this.save(newRecords);
  }

  getRecord(dateStr: string): DailyRecord | undefined {
    if (!this.data) return undefined;
    const idx = this._dateIndex.get(dateStr);
    if (idx === undefined) return undefined;
    const record = this.data[idx];
    return record.isDeleted ? undefined : record;
  }

  // Derived views for UI

  private _events: readonly DailyRecord[] = [];
  private _dateIndex = new Map<string, number>();

  protected override onDataChanged(data: DailyRecord[]): void {
    this._events = data.filter(r => !r.isDeleted);
    this._dateIndex = new Map();
    for (let i = 0; i < data.length; i++) {
      this._dateIndex.set(data[i].date, i);
    }
  }

  get events(): readonly DailyRecord[] {
    return this._events;
  }

  get allRecords(): readonly DailyRecord[] | null {
    return this.data;
  }
}

