# LunaFlow Storage Architecture

This document outlines the architecture used to store, sync, and version data in LunaFlow.

## Core Concepts

1. **`DailyRecord`**: The single source of truth for a calendar day. All events (period, ovulation) are nested inside this single object.
2. **Versioned Envelope** (`StorageEnvelope` in `src/storage/StorageEnvelope.ts`): User data is wrapped in a versioned envelope for persistence and sync:
   ```json
   {
     "ver": 1,
     "records": [ { "date": "2024-01-01", ... } ]
   }
   ```
3. **Layered Architecture**:

```
CalendarApp.tsx  ← app shell: creates all instances, owns store lifecycle
  ├── GoogleAuthProvider     ← see AUTH_ARCHITECTURE.md
  ├── GoogleDriveProvider    ← pure storage: ensureFileExists, fetchData, uploadData
  └── RecordsStore           ← local persistence + sync orchestration

useCalendarEvents(store)  ← domain mutations only (handleDayClick, updateRecord)
```

---

## Component Responsibilities

### `GoogleDriveProvider` (`src/cloudStorageProviders/`)

Pure storage — no auth knowledge. Receives a `getToken` function via constructor injection:

```typescript
new GoogleDriveProvider(() => authProvider.getToken())
```

- `ensureFileExists(fileId: string): Promise<boolean>` — finds or creates the LunaFlow folder + file on Drive; maps logical `fileId` → Drive internal file ID internally
- `fetchData(fileId)` — calls `getToken()` to ensure GAPI is ready, then fetches from Drive
- `uploadData(fileId, data)` — calls `getToken()`, then PATCHes to Drive

The logical `fileId` (e.g. `'lunaflow_data'`) is defined by `DataStore`. `GoogleDriveProvider` maps it to the real Drive file ID in a private `Map<string, string>`.

**No singleton export.** Instance created lazily inside `CalendarApp` init effect when user is authenticated.

---

### `DataStore<T>` (`src/storage/`)

Abstract base class (plain TypeScript, no React) that handles:

- **Cache-first load**: `init()` reads local data immediately so UI renders before auth completes
- **`save(data)`**: writes to IndexedDB, schedules a debounced upload (2 s) to cloud
- **`forceSync()`**: fetch → merge → upload cycle; sets `cloudState` throughout
- **`connectCloud(provider)`**: sets the provider, calls `provider.ensureFileExists(this.fileId)`, triggers `forceSync()`
- **`disconnectCloud()`**: clears provider, resets `cloudState` to `'unsynced'`
- **`fileId`**: abstract getter — subclasses define their stable logical file key
- **Subscriber pattern**: `subscribeDataChanged(fn)` / `subscribeCloudSyncStateChanged(fn)` for React re-renders

Abstract methods subclasses must implement:

```typescript
abstract get fileId(): string;
protected abstract loadLocal(): Promise<T | null>;
protected abstract saveLocal(data: T): Promise<void>;
protected abstract merge(local: T, cloud: T): T;
protected abstract fetchFromCloud(fileId: string): Promise<T>;
protected abstract prepareDataToCloud(fileId: string, data: T): unknown;
```

---

### `RecordsStore` (`src/storage/`)

Concrete `DataStore<DailyRecord[]>`:
- `get fileId()` returns `'lunaflow_data'` — the stable logical key
- `loadLocal()` — reads from IndexedDB, validates each record via `validateDailyRecords()` (invalid records are dropped)
- `saveLocal()` — writes `DailyRecord[]` to IndexedDB
- `merge()` — last-write-wins by `updatedAt`
- `fetchFromCloud()` — fetches raw JSON, validates envelope via `parseStorageEnvelope()`, then runs migration pipeline
- `migrateData(envelope)` — accepts a validated `StorageEnvelope`, applies versioned migrations
- `prepareDataToCloud()` — wraps in `{ ver, records }` envelope for upload

Exposes derived views:
- `events` — filtered (excludes tombstones with `isDeleted: true`)
- `allRecords` — full array including tombstones, or `null` if not yet loaded

**No singleton export.** Instance created via `useMemo` in `CalendarApp`.

---

### `CalendarApp` (`src/components/`)

The app shell and orchestrator. Creates instances once via `useMemo`:

```typescript
const recordsStore = useMemo(() => new RecordsStore(), []);
```

Active cloud provider selection is plain React state initialized from localStorage:

```typescript
const [selectedProviderId, setSelectedProviderId] = useState(
  () => localStorage.getItem(CLOUD_PROVIDER_KEY) ?? 'google-drive'
);
```

Available providers are a constant in `src/constants.ts` (`AVAILABLE_CLOUD_PROVIDERS`), imported directly by the Settings UI — no registry needed.

Lifecycle `useEffect`:
1. `recordsStore.init()` — load local data (cache-first, runs immediately)
2. Auth initialization and cloud provider setup (see [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md))
3. Subscribe to store + auth changes for React re-renders

Owns browser env concerns: online/offline/focus listeners for `forceSync()`.

---

### `useCalendarEvents(store)` (`src/hooks/`)

Domain mutations only — no lifecycle, no auth:
- `handleDayClick(date)` — toggle period/ovulation on a day
- `updateRecord(dateStr, updates)` — merge partial updates into a record
- `events`, `activeType`, `setActiveType`

Receives `store: RecordsStore` as a parameter (no singleton import).

---

## Sync Flows

### 1. App start

1. Open IndexedDB connection
2. Load local data, validate, update UI immediately (cache-first, no auth needed)
3. Initialize auth (see [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md))
4. If authenticated, connect cloud provider:
   a. Ensure cloud file exists (create if missing)
   b. If file setup fails, disconnect provider and abort
   c. Trigger full sync

### 2. Save (user edit)

1. Update in-memory data, notify UI listeners
2. Write to IndexedDB
3. Schedule debounced cloud upload (2s delay, resets on repeated saves):
   a. If no cloud provider connected, skip
   b. Set state to `uploading`
   c. Wrap data in versioned envelope, upload to cloud
   d. Set state to `synced`
   e. On error: set state to `unsynced`

### 3. Full sync

Triggered by: cloud connect, browser comes online, window regains focus.

1. Guard: skip if no cloud provider or if an upload is already in progress
2. Set state to `syncing`
3. Fetch cloud data, validate envelope, validate each record, run migrations
4. Merge local and cloud (last-write-wins per record by timestamp)
5. If merged differs from local: update local storage + notify UI
6. If merged differs from cloud: schedule upload to cloud
7. If merged matches both: set state to `synced`
8. On error: set state to `unsynced`

### Cloud state

Four domain values: `unsynced`, `uploading`, `syncing`, `synced`.

The UI derives a fifth display-only state `offline` from browser online status. This is never stored in the data store.

---

## Local Storage: IndexedDB

LunaFlow uses **IndexedDB** (not localStorage) for local data persistence:
- **Database**: `lunaflow`
- **Object Store**: `appData`
- **Key**: `events`
- **Value**: `DailyRecord[]`

All IndexedDB I/O is in `src/storage/indexedDBStorage.ts` (type-agnostic `read`/`write`). Validation happens in `RecordsStore.loadLocal()`, not in the I/O layer.

localStorage is used only for small flags: `LAUNCHED_KEY`, `CLOUD_PROVIDER_KEY`, auth token.

---

## Schema Validation

Runtime validation uses **Valibot** schemas at the two trust boundaries where untrusted data enters:

1. **`fetchFromCloud()`** — cloud data is validated via `parseStorageEnvelope()` (two-phase: envelope shape first, then each record individually). Invalid envelope → return empty. Invalid records within a valid envelope → dropped with `console.warn`.
2. **`loadLocal()`** — IndexedDB data is validated via `validateDailyRecords()`. Invalid records are dropped.

Schemas are co-located with their interfaces:
- `src/storage/DailyRecord.ts` — `DailyRecordSchema`, `validateDailyRecords()`
- `src/storage/StorageEnvelope.ts` — `parseStorageEnvelope()`

Type safety: the `validateDailyRecords()` return type (`DailyRecord[]`) enforces compile-time sync between schema and interface — if they drift, `tsc` fails.

---

## Migration Pipeline

`RecordsStore.fetchFromCloud()` validates raw cloud data into a `StorageEnvelope`, then passes it to `migrateData(envelope)`.

Migration functions are registered in `src/storage/migrationData.ts`:

```typescript
const migrations: MigrationFunction[] = [
  undefined, // Index 0 unused — versions start at 1
];
```

To add version N:
1. Bump `STORAGE_CURRENT_VERSION` in `src/constants.ts`
2. Write `migrateVNtoVN+1(records)` in `migrationData.ts`
3. Register at the correct index
4. Update `DailyRecord` in `src/storage/DailyRecord.ts` and its schema in `src/storage/DailyRecord.schema.ts`

IndexedDB always stores plain `DailyRecord[]` — never needs migration on read.

---

## Adding a new storage provider

1. Implement `CloudStorageProvider` interface in `src/cloudStorageProviders/`
2. Create a matching `AuthProvider` (or extend `GoogleAuthProvider` if reusable)
3. Add an entry to `AVAILABLE_CLOUD_PROVIDERS` in `src/constants.ts`
4. Handle provider instantiation in `CalendarApp` init effect based on `selectedProviderId`
5. No changes needed to `DataStore`, `RecordsStore`, or any hook
