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
   - **Storage Providers** (in `src/storageProviders/`): Abstract implementations of the `RemoteStorageProvider` interface. They handle the specifics of each vendor's API (e.g., `googleService.ts` for Google Drive).
   - `storageService.ts` handles **IndexedDB** (local storage), merging, and is the entry point for migration (`parseAndMigrateData`).
   - `migrationService.ts` is a registry of transformation functions. It defines the `migrations` array.

## Local Storage: IndexedDB

LunaFlow uses **IndexedDB** (not localStorage) for local data persistence. IndexedDB provides:
- Async API (non-blocking)
- ~50MB+ storage limit vs localStorage's 5-10MB
- Better eviction behavior in Safari PWA context

### Database Layout

- **Database**: `lunaflow` (version 1)
- **Object Store**: `appData`
- **Key**: `events`
- **Value**: versioned blob `{ ver: 2, records: DailyRecord[] }`

### API

```typescript
// Read records (async, runs migration pipeline)
const records = await getStoredEvents();

// Write records (async)
await saveStoredEvents(records);
```

Both functions are in `src/services/storageService.ts` and are implemented using the native IndexedDB API — no external library.

### Async Initialization in useCalendarEvents

Since IndexedDB is async, `useCalendarEvents` starts with an empty array and loads records in a `useEffect`:

```typescript
const [records, setRecords] = useState<DailyRecord[]>([]);
const isLoaded = useRef(false); // guards against saving empty state on mount

useEffect(() => {
  getStoredEvents().then(events => {
    setRecords(events);
    isLoaded.current = true;
    setIsLoaded(true);
  });
}, []);
```

The `isLoaded` state (also returned from the hook) can be used to show a loading indicator while IndexedDB reads.

**Note for developers**: If you clear the IndexedDB database (e.g., via Chrome DevTools > Application > IndexedDB), existing data will be lost. Re-sync from Google Drive if authenticated.

## Storage Abstraction

To support multiple storage vendors (e.g., Google Drive, Dropbox, OneDrive), LunaFlow uses a robust abstraction layer located in `src/storageProviders/`.

1. **`RemoteStorageProvider` Interface**: A TypeScript interface that defines the required methods for any remote storage implementation (`id`, `name`, `initialize`, `signIn`, `signOut`, `fetchData`, `uploadData`, `restoreSession`, and an optional `handleCallback` for OAuth redirects).
2. **`StorageProviderRegistry`**: A central registry that maps string IDs (e.g., `google-drive`) to their corresponding `RemoteStorageProvider` instances. This allows the application to dynamically resolve the active provider based on user settings.
3. **`GoogleDriveProvider`**: The primary implementation of the `RemoteStorageProvider` interface, which wraps the `googleService.ts` transport layer.
4. **`useRemoteSync` Hook**: This hook is entirely provider-agnostic. It accepts a `RemoteStorageProvider` instance (resolved from the registry in `CalendarApp.tsx`) and handles the high-level synchronization logic, such as:
   - Conflict resolution (merging local and remote data).
   - Auto-saving local changes to remote.
   - Polling/Syncing on window focus.
   - Session restoration.
   - Triggering the provider's `handleCallback` method during initialization.

This architecture allows for adding new storage providers without modifying the core synchronization logic or application structure. Simply create a new class implementing `RemoteStorageProviderInterface` and register it in the `StorageProviderRegistry`.

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
