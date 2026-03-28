import type { DailyRecord } from '../types';

export type MigrationFunction = (data: DailyRecord[]) => DailyRecord[];

/**
 * Standard identity migration function for when the schema is backwards compatible
 * and only the version number needs to be bumped.
 */
export const migrateVersionNumber = (records: DailyRecord[]): DailyRecord[] => {
  return records;
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 * Index 0 is unused (versions start at 1).
 */
export const migrations: MigrationFunction[] = [
  () => [] as DailyRecord[], // Index 0 (unused)
];
