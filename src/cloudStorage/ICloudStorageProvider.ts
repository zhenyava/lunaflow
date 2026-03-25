import type { DailyRecord } from '../types';

/** Opaque token — the sync hook never inspects its contents */
export interface CloudAuthToken {
  accessToken: string;
  expiresAt: number; // ms since epoch
}

/** The contract every cloud storage provider must implement */
export interface ICloudStorageProvider {
  readonly id: string;          // e.g. 'google-drive'
  readonly displayName: string; // e.g. 'Google Drive'

  /** One-time SDK initialization. Resolves true on success. */
  initialize(): Promise<boolean>;

  /** Begin OAuth login flow. Typically causes a full-page redirect. */
  login(): Promise<void>;

  /** Restore an existing session from persisted state. Returns null if none. */
  restoreSession(): Promise<CloudAuthToken | null>;

  /** Extract token from URL after OAuth callback redirect. Cleans the URL. Returns null if not present. */
  parseCallbackToken(): CloudAuthToken | null;

  /** Ensure the access token is valid, refreshing if needed. Throws 'Unauthorized' if unrecoverable. */
  ensureValidToken(): Promise<CloudAuthToken>;

  /** Ensure the app's data file exists in cloud storage. Returns an opaque fileRef string. */
  ensureFileExists(): Promise<string>;

  /** Upload records to the cloud storage file. Provider handles serialization internally. */
  uploadData(fileRef: string, records: DailyRecord[]): Promise<void>;

  /** Fetch records from the cloud storage file. Provider handles deserialization and migration internally. */
  fetchData(fileRef: string): Promise<DailyRecord[]>;

  /** Revoke tokens and clear all persisted auth state. */
  logout(): Promise<void>;
}
