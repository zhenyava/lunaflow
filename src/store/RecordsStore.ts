import type { DailyRecord } from '../types';
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

  protected merge(local: DailyRecord[], remote: DailyRecord[]): DailyRecord[] {
    const map = new Map<string, DailyRecord>();
    for (const record of [...local, ...remote]) {
      const existing = map.get(record.date);
      if (!existing || record.updatedAt > existing.updatedAt) {
        map.set(record.date, record);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  protected async fetchFromCloud(fileId: string): Promise<DailyRecord[]> {
    if (!this._remoteStorageProvider) throw new Error('No storage provider');
    const raw = await this._remoteStorageProvider.fetchData(fileId);
    return this.migrateData(raw).records;
  }

  protected prepareDataToCloud(data: DailyRecord[]): unknown {
    return { ver: STORAGE_CURRENT_VERSION, records: data };
  }

  private migrateData(parsedData: unknown): { records: DailyRecord[]; wasMigrated: boolean } {
    if (!parsedData) return { records: [], wasMigrated: false };

    let currentVer = 1;
    let records: DailyRecord[];

    if (typeof parsedData === 'object' && 'ver' in parsedData) {
      const dataObj = parsedData as Record<string, unknown>;
      currentVer = dataObj.ver as number;
      records = dataObj.records as DailyRecord[];
    } else {
      return { records: [], wasMigrated: false };
    }

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

  get events(): readonly DailyRecord[] {
    return (this.data ?? []).filter(r => !r.isDeleted);
  }

  get allRecords(): readonly DailyRecord[] {
    return this.data ?? [];
  }

  get isLoaded(): boolean {
    return this.data !== null;
  }
}

export const recordsStore = new RecordsStore();
