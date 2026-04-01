export type MigrationFunction<T> = (data: T) => T;

export abstract class DataMigrationService<T> {
  protected targetVersion: number;
  protected migrations: Array<MigrationFunction<T>>;

  constructor(
    targetVersion: number,
    migrations: Array<MigrationFunction<T>>
  ) {
    this.targetVersion = targetVersion;
    this.migrations = migrations;
  }

  protected abstract getVersion(data: T): number;
  protected abstract setVersion(data: T, version: number): T;

  migrate(data: T): T {
    let currentVer = this.getVersion(data);
    let migratedData = data;

    while (currentVer < this.targetVersion && currentVer < this.migrations.length) {
      const migrateFn = this.migrations[currentVer];
      if (migrateFn) {
        migratedData = migrateFn(migratedData);
        currentVer++;
        migratedData = this.setVersion(migratedData, currentVer);
      } else {
        break;
      }
    }

    return migratedData;
  }
}
