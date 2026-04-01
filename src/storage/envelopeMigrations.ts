import type { StorageEnvelope } from './StorageEnvelope';

export type MigrationFunction = (data: StorageEnvelope) => StorageEnvelope;

/**
 * Standard identity migration function for when the schema is backwards compatible
 * and only the version number needs to be bumped.
 */
export const migrateVersionNumber = (env: StorageEnvelope): StorageEnvelope => {
  return env;
};

/**
 * Array of migration functions.
 * The index in the array matches the version number the data is migrating FROM.
 * Index 0 is unused (versions start at 1).
 */
export const migrations: MigrationFunction[] = [
  (env: StorageEnvelope) => env, // Index 0 (unused)
];
