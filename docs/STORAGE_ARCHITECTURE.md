# LunaFlow Storage Architecture

This document outlines the architecture used to store, sync, and version data in LunaFlow.

## Core Concepts

1. **`DailyRecord`**: The single source of truth for a calendar day. All events (period, ovulation) are nested inside this single object.
2. **`StorageEnvelope`**: User data is wrapped in a versioned envelope for persistence and sync. This is the unit of storage managed by the `DataStore`.
   ```json
   {
     "ver": 1,
     "records": [ { "date": "2024-01-01", ... } ]
   }
   ```
3. **Composition-Based Architecture**:
   The system follows a "Composition over Inheritance" pattern. Infrastructure adapters handle raw data, while a central orchestrator manages domain logic, validation, and syncing.

```
CalendarApp.tsx  ← app shell: creates all instances, owns store lifecycle
  ├── GoogleAuthProvider     ← see AUTH_ARCHITECTURE.md
  └── RecordsStore           ← Domain Facade: manages business logic
       └── DataStore<StorageEnvelope> ← Orchestrator: sync & persistence logic
            ├── IndexedDBProvider     ← LocalStorageProvider (raw I/O)
            ├── GoogleDriveProvider   ← CloudStorageProvider (raw I/O)
            └── EnvelopeMigrationService ← DataMigrationService (domain logic)

useCalendarEvents(store)  ← domain mutations only (via RecordsStore)
```

---

## Lifecycle Contract

Both `DataStore` and `RecordsStore` implement a **Strict Guard** pattern to ensure data integrity and prevent race conditions.

### Mandatory Initialization
Before calling any data-modifying methods (`save`, `upsertRecord`, `forceSync`, `connectCloud`, `disconnectCloud`), you **must** call and await `init()`. 

- **Fail-Fast**: If a method is called before `init()`, an explicit `Error` is thrown.
- **Idempotency**: Multiple calls to `init()` are safe; they return the same initialization promise.
- **Async Safety**: Methods called while `init()` is still pending will automatically `await` its completion before proceeding. This prevents race conditions where mutations could overwrite data that is still being loaded from local storage.

### Error Handling & Finality
The `init()` process always reaches a terminal state:
- **Success**: Data is loaded, validated, migrated, and subscribers are notified.
- **Corruption/Missing**: If data is missing or validation fails, state is set to `null` and subscribers are notified that loading is finished.
- **Failure**: If the local provider throws an error, it is caught, logged, and state is set to `null`.

This ensures the UI never hangs in an infinite "loading" state.

---

## Component Responsibilities

### Infrastructure Adapters (Raw I/O)

These adapters are **type-agnostic**. They work with `unknown` data and do not know about `DailyRecord` or `StorageEnvelope`.

#### `LocalStorageProvider` (`src/storage/LocalStorageProvider.ts`)
Interface for local persistence.
- `read(): Promise<unknown>`
- `write(data: unknown): Promise<void>`

**Implementation**: `IndexedDBProvider` (in `src/storage/indexedDBStorage.ts`) wraps functional IndexedDB calls.

#### `CloudStorageProvider` (`src/cloudStorageProviders/`)
Interface for cloud storage (e.g., Google Drive).
- `fetchData(path: string): Promise<unknown>`
- `uploadData(path: string, data: unknown): Promise<void>`

---

### Orchestration Layer

#### `DataStore<T>` (`src/storage/DataStore.ts`)
A concrete orchestrator class that manages the lifecycle of a specific data type `T`. It is injected with infrastructure providers and domain-specific functions.

**Constructor Dependencies**:
- `local: LocalStorageProvider`
- `migrationService: DataMigrationService<T> | null`
- `validator: (raw: unknown) => T | null`
- `merger: (local: T, cloud: T) => T`
- `isEqual: (a: T, b: T) => boolean`
- `cloudPath: string`

**Responsibilities**:
- **Cache-first load**: `init()` reads local data, validates it, applies migrations, and updates state.
- **Save**: `save(data)` updates state, writes to local storage, and schedules a debounced cloud upload.
- **Sync**: `forceSync()` fetches from cloud, validates/migrates, merges with local state, and resolves conflicts.
- **State management**: Tracks `cloudState` (`unsynced`, `uploading`, `synced`, `syncing`).

---

### Domain Layer

#### `DataMigrationService<T>` (`src/storage/migrationService.ts`)
Abstract base class for versioned migrations.
- `migrate(data: T): T` — loops through migration functions until `targetVersion` is reached.

**Implementation**: `EnvelopeMigrationService` (in `src/storage/StorageEnvelope.ts`) manages migrations for the `StorageEnvelope`.

#### `RecordsStore` (`src/storage/RecordsStore.ts`)
The domain facade for `DailyRecord` data. It hides the complexity of `DataStore` and provides a clean API for the UI.
- Owns the `DataStore<StorageEnvelope>` instance.
- Provides derived views: `events` (filtered records) and `allRecords`.
- Implements `async upsertRecord` and `async getRecord` logic with initialization guards.
- **Sync Consistency**: Maintains an internal `_allRecordsInternal` cache that is updated *synchronously* during `upsertRecord`. This allows subsequent reads (even within the same microtask) to see the latest changes immediately, bypassing the inherent async delay of the underlying `DataStore.save()`.

---

## Sync Flows

### 1. App start
1. `RecordsStore.init()` called.
2. `DataStore` reads raw data from `IndexedDBProvider`.
3. `DataStore` validates raw data using `parseStorageEnvelope`.
4. `DataStore` migrates data using `EnvelopeMigrationService` (applying `StorageEnvelope` migrations).
5. UI is notified of data change.

### 2. Full Sync
Triggered by cloud connect, online status change, or window focus.
1. `DataStore` fetches raw `unknown` from `CloudStorageProvider`.
2. `DataStore` validates and migrates the fetched data.
3. `DataStore` merges local and cloud data using the injected `merger` (last-write-wins per record).
4. `DataStore` uses `isEqual` (fast comparison of record timestamps) to determine if local or cloud needs an update.

---

## Schema Validation

Validation happens at the `DataStore` boundary using the injected `validator`. For records, this is `parseStorageEnvelope`, which uses **Valibot** for two-phase validation:
1. Validate the envelope shape (`ver`, `records` array).
2. Validate each record individually via `validateDailyRecords`.

---

## Local Storage: IndexedDB
- **Database**: `lunaflow`
- **Object Store**: `appData`
- **Key**: `events`
- **Value**: `StorageEnvelope`

---

## Adding a new data type
1. Define the data interface and a Valibot schema.
2. If versioning is needed, define a `StorageEnvelope` equivalent.
3. Implement a `DataMigrationService` if necessary.
4. Define migrations in a specific file (e.g., `src/storage/myTypeMigrations.ts`).
5. Instantiate `DataStore<MyType>` with appropriate adapters and domain functions.
