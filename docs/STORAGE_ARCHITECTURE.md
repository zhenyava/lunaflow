# LunaFlow Storage Architecture

This document outlines the architecture used to store, sync, and version data in LunaFlow.

## Core Concepts

1. **`DailyRecord`**: The single source of truth for a calendar day. All events (period, ovulation) are nested inside this single object.
2. **Versioned Envelope**: Data on Google Drive is wrapped in an envelope containing a version number:
   ```json
   {
     "ver": 1,
     "records": [ { "date": "2024-01-01", ... } ]
   }
   ```
3. **Layered Architecture**:

```
CalendarApp.tsx  ← app shell: creates all instances, owns auth + store lifecycle
  ├── GoogleAuthProvider     ← OAuth, tokens, GAPI SDK init, sign-in/out
  ├── GoogleDriveProvider    ← pure storage: ensureFileExists, fetchData, uploadData
  ├── StorageProviderRegistry ← pure catalog: provider list + active selection
  └── RecordsStore           ← local persistence + sync orchestration

useCalendarEvents(store)  ← domain mutations only (handleDayClick, updateRecord)
```

---

## Component Responsibilities

### `GoogleAuthProvider` (`src/auth/`)

Owns all OAuth concerns:
- `initialize()` — parse OAuth redirect callback, load GAPI script, restore token from localStorage
- `signIn()` / `signOut()` — redirect to `/api/auth/login`, call `/api/auth/logout`
- `isAuthenticated()` — checks localStorage for a valid token
- `getToken()` — returns a valid token, auto-refreshes via `/api/auth/refresh` if expired, syncs to GAPI client
- `onAuthStateChange(fn)` — subscriber pattern; fires on sign-in/sign-out

**No singleton export.** Instance created via `useMemo` in `CalendarApp`.

---

### `GoogleDriveProvider` (`src/storageProviders/`)

Pure storage — no auth knowledge. Receives a `getToken` function via constructor injection:

```typescript
new GoogleDriveProvider(() => authProvider.getToken())
```

- `ensureFileExists(fileId: string): Promise<boolean>` — finds or creates the LunaFlow folder + file on Drive; maps logical `fileId` → Drive internal file ID internally
- `fetchData(fileId)` — calls `getToken()` to ensure GAPI is ready, then fetches from Drive
- `uploadData(fileId, data)` — calls `getToken()`, then PATCHes to Drive

The logical `fileId` (e.g. `'lunaflow_data'`) is defined by `DataStore`. `GoogleDriveProvider` maps it to the real Drive file ID in a private `Map<string, string>`.

**No singleton export.** Instance created lazily inside `CalendarApp.init()` when user is authenticated.

---

### `StorageProviderRegistry` (`src/storageProviders/`)

Pure catalog of available providers and which one is selected:
- `registerProvider({ id, name })` — add a provider descriptor
- `getAllProviders()` — returns `{ id, name }[]` for the UI
- `activeProviderId` / `setActiveProvider(id)` — persisted to localStorage
- `subscribe(fn)` / `notify()` — triggers CalendarApp re-renders on selection change

Does **not** hold provider instances, handle auth, or call `signOut()`. Those are CalendarApp's responsibility.

**No singleton export.** Instance created via `useMemo` in `CalendarApp`.

---

### `DataStore<T>` (`src/store/`)

Abstract base class (plain TypeScript, no React) that handles:

- **Cache-first load**: `init()` reads local data immediately so UI renders before auth completes
- **`save(data)`**: writes to IndexedDB, schedules a debounced upload (2 s) to cloud
- **`forceSync()`**: fetch → merge → upload cycle; sets `cloudState` throughout
- **`connectRemote(provider)`**: sets the provider, calls `provider.ensureFileExists(this.fileId)`, triggers `forceSync()`
- **`disconnectRemote()`**: clears provider, resets `cloudState` to `'unsynced'`
- **`fileId`**: abstract getter — subclasses define their stable logical file key
- **Subscriber pattern**: `subscribe(fn)` / `notify()` for React re-renders

Abstract methods subclasses must implement:

```typescript
abstract get fileId(): string;
protected abstract loadLocal(): Promise<T | null>;
protected abstract saveLocal(data: T): Promise<void>;
protected abstract merge(local: T, remote: T): T;
protected abstract fetchFromCloud(fileId: string): Promise<T>;
protected abstract pushToCloud(fileId: string, data: T): Promise<void>;
```

---

### `RecordsStore` (`src/store/`)

Concrete `DataStore<DailyRecord[]>`:
- `get fileId()` returns `'lunaflow_data'` — the stable logical key
- `loadLocal()` / `saveLocal()` — reads/writes `DailyRecord[]` to IndexedDB
- `merge()` — last-write-wins by `updatedAt`
- `fetchFromCloud()` — fetches raw JSON, runs migration pipeline
- `pushToCloud()` — wraps in `{ ver, records }` envelope and uploads

Exposes derived views:
- `events` — filtered (excludes tombstones with `isDeleted: true`)
- `allRecords` — full array including tombstones
- `isLoaded` — `true` once the first IndexedDB read completes

**No singleton export.** Instance created via `useMemo` in `CalendarApp`.

---

### `CalendarApp` (`src/components/`)

The app shell and orchestrator. Creates all instances once via `useMemo`:

```typescript
const authProvider = useMemo(() => new GoogleAuthProvider(), []);
const registry    = useMemo(() => new StorageProviderRegistry(), []);
const recordsStore = useMemo(() => new RecordsStore(), []);
```

Lifecycle `useEffect`:
1. `recordsStore.init()` — load local data (cache-first, runs immediately)
2. `authProvider.initialize()` — parse callback, load GAPI, restore token
3. If authenticated → create `GoogleDriveProvider` lazily, call `recordsStore.connectRemote(provider)`
4. Subscribe to store + auth + registry changes for React re-renders

Owns browser env concerns: online/offline/focus listeners for `forceSync()`.

---

### `useCalendarEvents(store)` (`src/hooks/`)

Domain mutations only — no lifecycle, no auth:
- `handleDayClick(date)` — toggle period/ovulation on a day
- `updateRecord(dateStr, updates)` — merge partial updates into a record
- `events`, `isLoaded`, `activeType`, `setActiveType`

Receives `store: RecordsStore` as a parameter (no singleton import).

---

## Sync Flows

### 1. App start

```
CalendarApp mounts
  │
  ├─► recordsStore.init()
  │       └─► loadLocal() ──────────────────────────► update UI (cache-first)
  │
  └─► authProvider.initialize()
          ├─► handleCallback()  (parse OAuth redirect if present)
          ├─► initGapi()        (load GAPI script + client.init)
          └─► restoreGapiSession()
                  │
                  └─► [if isAuthenticated()]
                          └─► new GoogleDriveProvider(getToken)
                                  └─► recordsStore.connectRemote(provider)
                                          ├─► provider.ensureFileExists('lunaflow_data')
                                          └─► forceSync()
```

### 2. User edit (`save(data)`)

```
save(data)
  │
  ├─► saveLocal(data)           (IndexedDB write, synchronous to user)
  ├─► cloudState = 'unsynced'
  ├─► notify()                  (UI re-renders)
  └─► scheduleUpload(data)      (cancel previous 2s timer, start new one)
          └─► [2s later, if provider connected + online]
                  ├─► cloudState = 'uploading'
                  ├─► notify()
                  ├─► pushToCloud('lunaflow_data', data)
                  ├─► cloudState = 'synced'
                  └─► notify()
```

### 3. Full sync (`forceSync()`)

Triggered by: `connectRemote`, online event, focus event.

```
forceSync()
  │
  ├─► [guard: provider not connected → return]
  ├─► cloudState = 'uploading'
  ├─► notify()
  ├─► fetchFromCloud('lunaflow_data') ──► migrateData()  →  remote: T
  ├─► merge(local, remote)             ──► merged: T
  │
  ├─► [if merged ≠ local]  saveLocal(merged)
  ├─► [if merged ≠ remote] pushToCloud('lunaflow_data', merged)
  │
  ├─► cloudState = 'synced'
  └─► notify()
```

### 4. Error handling

```
any sync error
  │
  ├─► cloudState = 'unsynced'   (data is safe locally; next sync will retry)
  ├─► notify()
  └─► [if 401 / Unauthorized]
          └─► _remoteStorageProvider = null   (disconnects remote; auth provider handles sign-out via its own state change)
```

### `cloudState` vs display state

`cloudState` (`'unsynced' | 'uploading' | 'synced'`) is a domain value. The UI adds one extra state at the `CalendarApp` layer:

```typescript
const displaySyncState = { status: navigator.onLine ? cloudState : 'offline' as const };
```

`'offline'` is a display-only concern — never stored in `DataStore`.

---

## Local Storage: IndexedDB

LunaFlow uses **IndexedDB** (not localStorage) for local data persistence:
- **Database**: `lunaflow`
- **Object Store**: `appData`
- **Key**: `events`
- **Value**: `DailyRecord[]`

All IndexedDB I/O is in `src/store/indexedDBStorage.ts` (`readDailyRecords`, `writeDailyRecords`).

---

## Migration Pipeline

`RecordsStore.fetchFromCloud()` calls `migrateData(rawData)` on every cloud fetch.

Migration functions are registered in `src/store/migrationData.ts`:

```typescript
const migrations: MigrationFunction[] = [
  undefined, // Index 0 unused — versions start at 1
];
```

To add version N:
1. Bump `STORAGE_CURRENT_VERSION` in `src/constants.ts`
2. Write `migrateVNtoVN+1(records)` in `migrationData.ts`
3. Register at the correct index
4. Update `DailyRecord` in `src/types.ts`

IndexedDB always stores plain `DailyRecord[]` — never needs migration on read.

---

## Adding a new storage provider

1. Implement `RemoteStorageProvider` interface in `src/storageProviders/`
2. Create a matching `AuthProvider` (or extend `GoogleAuthProvider` if reusable)
3. Register descriptor in `CalendarApp`: `registry.registerProvider({ id: '...', name: '...' })`
4. Handle provider switch in `CalendarApp.handleProviderChange()`
5. No changes needed to `DataStore`, `RecordsStore`, or any hook
