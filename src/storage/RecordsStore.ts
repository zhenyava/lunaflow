import type { DailyRecord } from './DailyRecord';
import type { StorageEnvelope } from './StorageEnvelope';
import { STORAGE_CURRENT_VERSION } from '../constants';
import * as idb from './indexedDBStorage';
import { migrations } from './migrationData';
import { DataStore } from './DataStore';

export class RecordsStore extends DataStore<DailyRecord[]> {
  get fileId(): string {
    return 'lunaflow_data';
  }

  protected async loadLocal(): Promise<DailyRecord[] | null> {
    try {
      return (await idb.readDailyRecords()) ?? [];
    } catch (e) {
      console.error('Failed to load from IndexedDB', e);
      return [];
    }
  }

  protected async saveLocal(data: DailyRecord[]): Promise<void> {
    try {
      await idb.writeDailyRecords(data);
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

  protected async fetchFromCloud(fileId: string): Promise<DailyRecord[]> {
    if (!this._cloudStorageProvider) throw new Error('No storage provider');
    const raw = await this._cloudStorageProvider.fetchData(fileId);
    return this.migrateData(raw).records;
  }

  protected prepareDataToCloud(data: DailyRecord[]): StorageEnvelope {
    return { ver: STORAGE_CURRENT_VERSION, records: data };
  }

  private migrateData(parsedData: unknown): { records: DailyRecord[]; wasMigrated: boolean } {
    if (!parsedData || typeof parsedData !== 'object' || !('ver' in parsedData)) {
      return { records: [], wasMigrated: false };
    }

    const envelope = parsedData as StorageEnvelope;
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

