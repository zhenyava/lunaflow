import type { DailyRecord } from '../types';

/**
 * Interface representing a remote storage provider (e.g., Google Drive, Dropbox).
 * De-couples the application's sync logic from specific vendor implementations.
 */
export interface RemoteStorageProvider {
  /**
   * The unique identifier for the storage provider (e.g., 'google-drive').
   */
  readonly id: string;

  /**
   * The name of the storage provider (e.g., 'Google Drive').
   */
  readonly name: string;

  /**
   * Handles any necessary OAuth callback logic (e.g., parsing URL hashes).
   */
  handleCallback?(): void;

  /**
   * Initializes the storage provider's SDK or API.
   * @param onInit Callback triggered when initialization is complete.
   */
  initialize(onInit: (success: boolean) => void): void;

  /**
   * Triggers the provider's sign-in flow.
   * Note: Some providers might redirect the page.
   */
  signIn(): Promise<void>;

  /**
   * Triggers the provider's sign-out flow.
   */
  signOut(): Promise<void>;

  /**
   * Checks if the data file exists on the remote storage.
   * If it doesn't exist, it should create an empty one.
   * @returns The remote file identifier (e.g., File ID or Path).
   */
  ensureFileExists(): Promise<string>;

  /**
   * Fetches the data content from the remote storage.
   * @param fileId The remote identifier of the file.
   * @returns The raw parsed data (usually a JSON object).
   */
  fetchData(fileId: string): Promise<unknown>;

  /**
   * Uploads the local data to the remote storage.
   * @param fileId The remote identifier of the file.
   * @param events The array of DailyRecord objects to upload.
   */
  uploadData(fileId: string, events: DailyRecord[]): Promise<void>;

  /**
   * Checks if the provider is currently authenticated.
   */
  isAuthenticated(): boolean;

  /**
   * Attempts to restore a previous session (e.g., from local storage).
   * @returns The file identifier if the session was successfully restored, otherwise null.
   */
  restoreSession(): Promise<string | null>;
}
