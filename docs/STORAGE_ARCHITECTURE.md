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
  (data) => data, // Index 0 (unused, versions start at 1)
  migrateV1ToV2,  // Index 1: migrates data FROM v1 TO v2
  // migrateV2ToV3, // Index 2: migrates data FROM v2 TO v3 (future)
];
```

The `parseAndMigrateData(rawData)` function:
1. Detects the version of `rawData`. Legacy flat arrays are considered `ver: 1`.
2. Uses a `while` loop to pass the data through every migration function starting from `currentVer` up to `STORAGE_CURRENT_VERSION`.
3. Returns a clean array of `DailyRecord[]`.

## How to add a new version in the future

If we need to change the schema again (e.g., to version 3):

1. **Update Constants**: 
   In `src/constants.ts`, bump `STORAGE_CURRENT_VERSION = 3`.
2. **Write the Migration**:
   In `src/services/migrationService.ts`, write a new function `migrateV2ToV3(v2Data)`. It should accept the `v2` format, modify it, and return `{ ver: 3, records: [...] }`.
3. **Register the Migration**:
   Add `migrateV2ToV3` to the `migrations` array at index `2`.
4. **Update Types**:
   Update `DailyRecord` in `src/types.ts` to reflect the v3 changes.

Because data fetched from both `localStorage` and Google Drive passes through `parseAndMigrateData`, the application will automatically update the data everywhere upon load and subsequent sync.
