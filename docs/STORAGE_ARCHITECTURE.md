# LunaFlow Storage Architecture & Migration

This document outlines the approach used to store, version, and migrate data in LunaFlow.

## Core Concepts

1. **`DailyRecord`**: The single source of truth for a calendar day. All events (period, ovulation) are nested inside this single object.
2. **Versioned Envelope**: Data is always stored locally and on Google Drive wrapped in an envelope containing a version number:
   ```json
   {
     "ver": 2,
     "records": [ { "date": "2024-01-01", ... } ]
   }
   ```
3. **Transport Layer vs. Business Logic**: 
   - `googleService.ts` is purely a transport layer. It only knows how to GET and PATCH JSON objects. It does not know what `ver` or `DailyRecord` are.
   - `storageService.ts` handles `localStorage`, merging, and is the entry point for migration (`parseAndMigrateData`).
   - `migrationService.ts` is a registry of transformation functions. It defines the `migrations` array.

## The Migration Pipeline

The entry point for migration logic is `parseAndMigrateData(rawData)` in `src/services/storageService.ts`.

It works sequentially based on an array of migration functions registered in `src/services/migrationService.ts`.

```typescript
const migrations: MigrationFunction[] = [
  (data) => data, // Index 0 (unused)
  migrateV1ToV2,  // Index 1: migrates FROM v1 TO v2
];
```

The `parseAndMigrateData(rawData)` function:
1. Detects the version of `rawData`. Legacy flat arrays are considered `ver: 1`.
2. Extracts the records array from the envelope (if `ver > 1`).
3. Uses a `while` loop to pass the **data array only** through every migration function starting from `currentVer` up to `STORAGE_CURRENT_VERSION`. 
4. Returns a clean array of `DailyRecord[]` and a `wasMigrated` flag.

**Key benefit:** Migration functions are pure data transformations. They don't need to know about the storage envelope or update the version number manually; the orchestrator handles that by incrementing the version after each successful function execution.

## How to add a new version in the future

If we need to change the schema again (e.g., to version 3):

1. **Update Constants**: 
   In `src/constants.ts`, bump `STORAGE_CURRENT_VERSION = 3`.
2. **Write the Migration**:
   In `src/services/migrationService.ts`, write a new function `migrateV2ToV3(records: DailyRecord[])`. It should accept the array of records and return the transformed array.
   *If no structural changes are needed, you can use the `migrateVersionNumber` identity function.*
3. **Register the Migration**:
   Add the new function to the `migrations` array at index `2`.
4. **Update Types**:
   Update `DailyRecord` in `src/types.ts` to reflect the v3 changes.

Because data fetched from both `localStorage` and Google Drive passes through `parseAndMigrateData`, the application will automatically update the data everywhere upon load and subsequent sync.
